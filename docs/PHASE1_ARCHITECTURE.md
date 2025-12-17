# Phase 1 Architecture - Backend Improvements

This document outlines the backend improvements for Phase 1 while preserving all existing configurator functionality.

## Current State

| Component | Status | Notes |
|-----------|--------|-------|
| 3D Configurator | ✅ Working | Preserve as-is |
| IFC Export | ✅ Working | Preserve as-is |
| Product Catalog | ✅ Working | Enhance with admin CRUD |
| Pricing | ⚠️ Client-side | Move to server-side |
| Auth/RBAC | ❌ Missing | Implement |
| Audit Logs | ❌ Missing | Implement |
| Saved Configs | ⚠️ Basic | Enhance with user ownership |

## Phase 1 Deliverables

### 1. Authentication and RBAC

**Goal**: Implement role-based access using Supabase Auth.

#### User Roles Table

```sql
-- Migration: 20250201_user_roles.sql

-- Role enum for type safety
CREATE TYPE user_role AS ENUM (
  'admin',           -- Full control
  'pricing_manager', -- Pricing + catalogue management
  'sales',           -- Quotes, customers, discounts
  'distributor',     -- Own orders, distributor pricing
  'viewer'           -- Read-only (future use)
);

CREATE TABLE user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role user_role NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, role)
);

-- Index for fast lookups
CREATE INDEX idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX idx_user_roles_role ON user_roles(role);

-- Distributor accounts with pricing tiers
CREATE TABLE distributors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  pricing_tier_id UUID REFERENCES pricing_tiers(id),
  account_number TEXT UNIQUE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id)
);

-- Pricing tiers for distributors
CREATE TABLE pricing_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,              -- e.g. 'Tier 1', 'Gold Partner'
  discount_percentage NUMERIC(5,2) NOT NULL DEFAULT 0,
  min_order_value NUMERIC,         -- Optional minimum order
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_distributors_user ON distributors(user_id);
CREATE INDEX idx_distributors_tier ON distributors(pricing_tier_id);

-- RLS
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE distributors ENABLE ROW LEVEL SECURITY;
ALTER TABLE pricing_tiers ENABLE ROW LEVEL SECURITY;

-- Only admins can view/modify roles
CREATE POLICY "user_roles_admin_only" ON user_roles
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_roles ur 
      WHERE ur.user_id = auth.uid() 
      AND ur.role = 'admin'
    )
  );

-- Users can view their own roles
CREATE POLICY "user_roles_self_select" ON user_roles
  FOR SELECT USING (user_id = auth.uid());

-- Distributors can view own record
CREATE POLICY "distributors_own" ON distributors
  FOR SELECT USING (user_id = auth.uid());

-- Admin/Sales can view all distributors
CREATE POLICY "distributors_staff" ON distributors
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_roles ur 
      WHERE ur.user_id = auth.uid() 
      AND ur.role IN ('admin', 'sales', 'pricing_manager')
    )
  );

-- Pricing tiers visible to staff only (distributors never see tier details)
CREATE POLICY "pricing_tiers_staff" ON pricing_tiers
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_roles ur 
      WHERE ur.user_id = auth.uid() 
      AND ur.role IN ('admin', 'pricing_manager')
    )
  );
```

#### Helper Functions

```sql
-- Check if current user has a specific role
CREATE OR REPLACE FUNCTION has_role(required_role user_role)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() 
    AND role = required_role
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if current user is internal staff (admin, sales, pricing_manager)
CREATE OR REPLACE FUNCTION is_staff()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'sales', 'pricing_manager')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if current user is admin or pricing_manager
CREATE OR REPLACE FUNCTION can_manage_pricing()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'pricing_manager')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get distributor pricing tier for current user (returns NULL if not distributor)
CREATE OR REPLACE FUNCTION get_user_pricing_tier()
RETURNS UUID AS $$
DECLARE
  v_tier_id UUID;
BEGIN
  SELECT d.pricing_tier_id INTO v_tier_id
  FROM distributors d
  WHERE d.user_id = auth.uid()
  AND d.is_active = true;
  
  RETURN v_tier_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get discount percentage for current user (0 for retail/staff)
CREATE OR REPLACE FUNCTION get_user_discount_percentage()
RETURNS NUMERIC AS $$
DECLARE
  v_discount NUMERIC;
BEGIN
  SELECT pt.discount_percentage INTO v_discount
  FROM distributors d
  JOIN pricing_tiers pt ON pt.id = d.pricing_tier_id
  WHERE d.user_id = auth.uid()
  AND d.is_active = true
  AND pt.is_active = true;
  
  RETURN COALESCE(v_discount, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 2. Server-Side Pricing

**Goal**: Move all pricing calculations to Supabase Edge Functions.

#### New Edge Function: `calculate-price`

```typescript
// supabase/functions/calculate-price/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface PricingRequest {
  productId: string
  selections: Record<string, unknown>
  customDrawers: Array<{
    id: string
    interiorId?: string
    accessories?: Array<{ accessoryId: string; quantity: number }>
  }>
  embeddedCabinets?: Array<unknown>
  customerType?: 'RETAIL' | 'WHOLESALE' | 'DEALER'
}

interface PricingResponse {
  totalPrice: number
  basePrice: number
  gst: number
  currency: string
  breakdown: Array<{ code: string; label: string; price: number }>
  // Staff-only fields (omitted for public)
  margin?: number
  cost?: number
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Check user role and distributor status if authenticated
    const authHeader = req.headers.get('Authorization')
    let userRole: string | null = null
    let userId: string | null = null
    let distributorTier: { id: string; discount_percentage: number } | null = null

    if (authHeader) {
      const { data: { user } } = await supabase.auth.getUser(
        authHeader.replace('Bearer ', '')
      )
      if (user) {
        userId = user.id
        
        // Get user role
        const { data: roles } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
        userRole = roles?.[0]?.role ?? null
        
        // If distributor, get their pricing tier
        if (userRole === 'distributor') {
          const { data: distData } = await supabase
            .from('distributors')
            .select('pricing_tier_id, pricing_tiers(id, discount_percentage)')
            .eq('user_id', user.id)
            .eq('is_active', true)
            .single()
          
          if (distData?.pricing_tiers) {
            distributorTier = distData.pricing_tiers as any
          }
        }
      }
    }

    const body: PricingRequest = await req.json()

    // Fetch product definition
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('*')
      .eq('id', body.productId)
      .single()

    if (productError || !product) {
      throw new Error(`Product not found: ${body.productId}`)
    }

    // Calculate pricing server-side
    const pricing = calculatePricing(product, body)

    // Apply distributor discount if applicable
    let finalPrice = pricing.totalPrice
    let appliedDiscount = 0
    
    if (distributorTier && distributorTier.discount_percentage > 0) {
      appliedDiscount = pricing.totalPrice * (distributorTier.discount_percentage / 100)
      finalPrice = pricing.totalPrice - appliedDiscount
    }

    // Recalculate GST on discounted price
    const finalGst = (finalPrice / 1.1) * 0.1

    // Build response based on role
    const response: PricingResponse = {
      // Distributors see their discounted price as the "price" (not as a discount)
      totalPrice: userRole === 'distributor' ? finalPrice : pricing.totalPrice,
      basePrice: pricing.basePrice,
      gst: userRole === 'distributor' ? finalGst : pricing.gst,
      currency: 'AUD',
      breakdown: pricing.breakdown,
    }

    // Add staff-only fields (admin, sales, pricing_manager)
    if (['admin', 'sales', 'pricing_manager'].includes(userRole ?? '')) {
      response.margin = pricing.margin
      response.cost = pricing.cost
      // Staff can see both retail and distributor prices
      if (distributorTier) {
        response.discountApplied = appliedDiscount
      }
    }

    // Log pricing request for analytics (non-blocking)
    supabase
      .from('pricing_logs')
      .insert({
        user_id: userId,
        product_id: body.productId,
        request_data: body,
        response_data: { totalPrice: pricing.totalPrice },
        customer_type: body.customerType ?? 'RETAIL',
      })
      .then(() => {})

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    console.error('Pricing error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})

function calculatePricing(product: any, request: PricingRequest) {
  // Import existing pricing logic from services/products/*.ts
  // This is a placeholder - actual implementation uses product-specific calculators
  const basePrice = product.base_price ?? 0
  const optionsTotal = 0 // Calculate from selections
  const drawersTotal = 0 // Calculate from customDrawers
  
  const subtotal = basePrice + optionsTotal + drawersTotal
  const gst = subtotal * 0.1
  const totalPrice = subtotal + gst
  
  // Cost/margin only calculated, never exposed to public
  const cost = subtotal * 0.6 // Example: 60% cost ratio
  const margin = subtotal - cost

  return {
    totalPrice,
    basePrice,
    gst,
    breakdown: [
      { code: 'BASE', label: product.name, price: basePrice },
      // ... other line items
    ],
    cost,
    margin,
  }
}
```

### 3. Audit Logging

**Goal**: Track all significant changes for compliance and debugging.

#### Audit Log Table

```sql
-- Migration: 20250202_audit_logs.sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  action TEXT NOT NULL,
  actor_id UUID REFERENCES auth.users(id),
  actor_email TEXT,
  before_data JSONB,
  after_data JSONB,
  metadata JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for querying
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_actor ON audit_logs(actor_id);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at DESC);

-- RLS: Only staff can view audit logs
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_logs_staff_only" ON audit_logs
  FOR SELECT USING (is_staff());
```

#### Audit Helper Function

```sql
-- Function to create audit log entries
CREATE OR REPLACE FUNCTION create_audit_log(
  p_entity_type TEXT,
  p_entity_id TEXT,
  p_action TEXT,
  p_before_data JSONB DEFAULT NULL,
  p_after_data JSONB DEFAULT NULL,
  p_metadata JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_audit_id UUID;
  v_actor_email TEXT;
BEGIN
  -- Get actor email if authenticated
  SELECT email INTO v_actor_email
  FROM auth.users
  WHERE id = auth.uid();

  INSERT INTO audit_logs (
    entity_type, entity_id, action,
    actor_id, actor_email,
    before_data, after_data, metadata
  ) VALUES (
    p_entity_type, p_entity_id, p_action,
    auth.uid(), v_actor_email,
    p_before_data, p_after_data, p_metadata
  )
  RETURNING id INTO v_audit_id;

  RETURN v_audit_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 4. Enhanced Saved Configurations

**Goal**: Allow users to save and retrieve their configurations.

#### Saved Configurations Table

```sql
-- Migration: 20250203_saved_configurations.sql
CREATE TABLE saved_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id TEXT, -- For anonymous users
  name TEXT NOT NULL DEFAULT 'Untitled Configuration',
  product_id TEXT NOT NULL REFERENCES products(id),
  configuration_data JSONB NOT NULL,
  pricing_snapshot JSONB,
  reference_code TEXT,
  is_public BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_saved_configs_user ON saved_configurations(user_id);
CREATE INDEX idx_saved_configs_session ON saved_configurations(session_id);
CREATE INDEX idx_saved_configs_product ON saved_configurations(product_id);

-- RLS
ALTER TABLE saved_configurations ENABLE ROW LEVEL SECURITY;

-- Users can view their own configs
CREATE POLICY "saved_configs_own" ON saved_configurations
  FOR ALL USING (
    user_id = auth.uid()
    OR (user_id IS NULL AND session_id = current_setting('app.session_id', true))
  );

-- Staff can view all configs
CREATE POLICY "saved_configs_staff" ON saved_configurations
  FOR SELECT USING (is_staff());

-- Anyone can view public configs
CREATE POLICY "saved_configs_public" ON saved_configurations
  FOR SELECT USING (is_public = true);
```

### 5. Admin Product Management

**Goal**: CRUD operations for products with proper permissions.

#### Product RLS Policies

```sql
-- Migration: 20250204_product_rls.sql

-- Enable RLS on products table
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- Everyone can read products
CREATE POLICY "products_public_read" ON products
  FOR SELECT USING (true);

-- Only admins can modify products
CREATE POLICY "products_admin_write" ON products
  FOR INSERT WITH CHECK (has_role('admin'));

CREATE POLICY "products_admin_update" ON products
  FOR UPDATE USING (has_role('admin'));

CREATE POLICY "products_admin_delete" ON products
  FOR DELETE USING (has_role('admin'));
```

#### Admin Edge Function: `admin-products`

```typescript
// supabase/functions/admin-products/index.ts
// CRUD operations with audit logging
// POST /admin-products - Create product
// PUT /admin-products/:id - Update product
// DELETE /admin-products/:id - Delete product
```

## Migration Order

Run migrations in this order:

1. `20250201_user_roles.sql` - User roles enum and table
2. `20250202_pricing_tiers.sql` - Pricing tiers for distributors
3. `20250203_distributors.sql` - Distributor accounts
4. `20250204_audit_logs.sql` - Audit logging infrastructure
5. `20250205_saved_configurations.sql` - Saved configurations
6. `20250206_product_rls.sql` - Product RLS policies
7. `20250207_pricing_logs.sql` - Pricing request logs
8. `20250208_notifications.sql` - Notification infrastructure

## Frontend Changes Required

### Auth Context

Create `contexts/AuthContext.tsx`:
- Wraps Supabase Auth
- Provides `user`, `role`, `isAdmin`, `isSales` flags
- Handles login/logout flows

### Updated Services

Update `services/pricingService.ts`:
- Call `calculate-price` Edge Function instead of `mockBackend`
- Pass auth token for role-based pricing fields

### Admin Routes

Enhance `components/admin/AdminDashboard.tsx`:
- Product CRUD UI
- User role management (admin only)
- Audit log viewer

## Testing Checklist

### Public User
- [ ] Can configure products without login
- [ ] Sees retail pricing only
- [ ] Cannot access backend/admin routes
- [ ] Existing 3D configurator works unchanged
- [ ] Existing IFC export works unchanged

### Distributor
- [ ] Can log in and configure products
- [ ] Sees distributor-specific pricing (not retail)
- [ ] Does NOT see discount percentage or tier details
- [ ] Can view own orders in backend
- [ ] Receives notifications for own orders
- [ ] Cannot access other distributors' data

### Sales
- [ ] Can see margin/cost in pricing response
- [ ] Can view all distributor pricing tiers
- [ ] Can create and manage quotes
- [ ] Can apply discounts within rules

### Pricing Manager
- [ ] Can manage catalogue and pricing tiers
- [ ] Can view audit logs
- [ ] Cannot manage users
- [ ] Cannot access feature switches

### Admin
- [ ] Full access to all features
- [ ] Can create/edit/delete products
- [ ] Can manage user roles
- [ ] Can access feature switches

### General
- [ ] All pricing changes create audit log entries
- [ ] RLS policies block unauthorised access
- [ ] Notification templates configured

## Rollback Plan

Each migration includes a corresponding down migration. To rollback:

```bash
supabase db reset --version 20250118  # Reset to last known good state
```

## 6. Notifications Infrastructure

**Goal**: Email notifications to relevant teams on key events.

> Note: Full implementation in Phase 2, but schema designed now.

#### Notifications Table

```sql
-- Migration: 20250206_notifications.sql
CREATE TYPE notification_type AS ENUM (
  'quote_submitted',
  'quote_accepted',
  'order_placed',
  'distributor_signup',
  'low_stock_alert',
  'price_change',
  'new_lead',
  'system_alert'
);

CREATE TYPE notification_channel AS ENUM (
  'email',
  'in_app',
  'both'
);

CREATE TABLE notification_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type notification_type NOT NULL UNIQUE,
  subject_template TEXT NOT NULL,
  body_template TEXT NOT NULL,         -- Supports {{variable}} placeholders
  default_channel notification_channel DEFAULT 'both',
  recipient_roles user_role[] NOT NULL, -- Which roles receive this notification
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type notification_type NOT NULL,
  recipient_id UUID REFERENCES auth.users(id),
  recipient_email TEXT,                 -- For non-user recipients
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  channel notification_channel NOT NULL,
  is_read BOOLEAN DEFAULT false,
  email_sent_at TIMESTAMPTZ,
  entity_type TEXT,                     -- 'quote', 'order', etc.
  entity_id TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_notifications_recipient ON notifications(recipient_id);
CREATE INDEX idx_notifications_type ON notifications(type);
CREATE INDEX idx_notifications_unread ON notifications(recipient_id, is_read) WHERE is_read = false;

-- RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Users see their own notifications
CREATE POLICY "notifications_own" ON notifications
  FOR SELECT USING (recipient_id = auth.uid());

-- Staff can view all notifications
CREATE POLICY "notifications_staff" ON notifications
  FOR SELECT USING (is_staff());
```

#### Notification Trigger Function

```sql
-- Queue notification for sending
CREATE OR REPLACE FUNCTION queue_notification(
  p_type notification_type,
  p_entity_type TEXT,
  p_entity_id TEXT,
  p_metadata JSONB DEFAULT '{}'
)
RETURNS VOID AS $$
DECLARE
  v_template notification_templates%ROWTYPE;
  v_role user_role;
  v_user RECORD;
  v_subject TEXT;
  v_body TEXT;
BEGIN
  -- Get template
  SELECT * INTO v_template
  FROM notification_templates
  WHERE type = p_type AND is_active = true;
  
  IF v_template IS NULL THEN
    RETURN;
  END IF;
  
  -- For each recipient role, find users and create notifications
  FOREACH v_role IN ARRAY v_template.recipient_roles
  LOOP
    FOR v_user IN 
      SELECT u.id, u.email
      FROM auth.users u
      JOIN user_roles ur ON ur.user_id = u.id
      WHERE ur.role = v_role
    LOOP
      -- Render templates (basic replacement)
      v_subject := v_template.subject_template;
      v_body := v_template.body_template;
      
      INSERT INTO notifications (
        type, recipient_id, recipient_email,
        subject, body, channel,
        entity_type, entity_id, metadata
      ) VALUES (
        p_type, v_user.id, v_user.email,
        v_subject, v_body, v_template.default_channel,
        p_entity_type, p_entity_id, p_metadata
      );
    END LOOP;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

## Role-Based UI Access Matrix

| Feature | Public | Distributor | Sales | Pricing Mgr | Admin |
|---------|--------|-------------|-------|-------------|-------|
| Configure products | ✅ | ✅ | ✅ | ✅ | ✅ |
| See retail price | ✅ | ❌ | ✅ | ✅ | ✅ |
| See distributor price | ❌ | ✅ (own tier) | ✅ (all) | ✅ | ✅ |
| See cost/margin | ❌ | ❌ | ✅ | ✅ | ✅ |
| Save configurations | ❌ | ✅ | ✅ | ✅ | ✅ |
| View own orders | ❌ | ✅ | ❌ | ❌ | ✅ |
| Create quotes | ❌ | ❌ | ✅ | ❌ | ✅ |
| Apply discounts | ❌ | ❌ | ✅ (rules) | ❌ | ✅ |
| Manage catalogue | ❌ | ❌ | ❌ | ✅ | ✅ |
| Manage pricing tiers | ❌ | ❌ | ❌ | ✅ | ✅ |
| Manage users | ❌ | ❌ | ❌ | ❌ | ✅ |
| View audit logs | ❌ | ❌ | ❌ | ✅ | ✅ |
| Feature switches | ❌ | ❌ | ❌ | ❌ | ✅ |

## Next Steps (Phase 2)

After Phase 1 is complete:
- Quote builder for sales reps
- Discount rules engine
- Quote versioning
- Customer management
- Full notification system with email delivery (Resend/SendGrid)
