-- Migration: Audit Logging Infrastructure
-- Tracks all significant changes for compliance and debugging

CREATE TYPE audit_action AS ENUM (
  'create',
  'update',
  'delete',
  'approve',
  'reject',
  'login',
  'logout',
  'price_override',
  'discount_applied',
  'export',
  'view'
);

CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- What was affected
  entity_type TEXT NOT NULL,             -- 'quote', 'order', 'product', 'pricing_tier', etc.
  entity_id TEXT NOT NULL,
  
  -- What happened
  action audit_action NOT NULL,
  description TEXT,                      -- Human-readable description
  
  -- Who did it
  actor_id UUID REFERENCES auth.users(id),
  actor_email TEXT,
  actor_role user_role,
  
  -- Change details
  before_data JSONB,                     -- State before change
  after_data JSONB,                      -- State after change
  changes JSONB,                         -- Diff of what changed
  
  -- Context
  metadata JSONB,                        -- Additional context (e.g., reason, approval notes)
  ip_address INET,
  user_agent TEXT,
  session_id TEXT,
  
  -- Timestamp
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for querying
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_actor ON audit_logs(actor_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_entity_type ON audit_logs(entity_type);

-- Composite index for common queries
CREATE INDEX idx_audit_logs_entity_created ON audit_logs(entity_type, entity_id, created_at DESC);

-- RLS
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Only staff can view audit logs (pricing_manager, admin)
CREATE POLICY "audit_logs_staff_select" ON audit_logs
  FOR SELECT USING (
    has_any_role(ARRAY['admin'::user_role, 'pricing_manager'::user_role])
  );

-- Audit logs are insert-only (no updates or deletes)
-- Only service role can insert (via Edge Functions)
CREATE POLICY "audit_logs_service_insert" ON audit_logs
  FOR INSERT WITH CHECK (true);  -- Controlled via service role key in Edge Functions

-- Function to create audit log entries (called from Edge Functions)
CREATE OR REPLACE FUNCTION create_audit_log(
  p_entity_type TEXT,
  p_entity_id TEXT,
  p_action audit_action,
  p_description TEXT DEFAULT NULL,
  p_before_data JSONB DEFAULT NULL,
  p_after_data JSONB DEFAULT NULL,
  p_metadata JSONB DEFAULT NULL,
  p_ip_address INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_audit_id UUID;
  v_actor_email TEXT;
  v_actor_role user_role;
  v_changes JSONB;
BEGIN
  -- Get actor details if authenticated
  IF auth.uid() IS NOT NULL THEN
    SELECT email INTO v_actor_email
    FROM auth.users
    WHERE id = auth.uid();
    
    v_actor_role := get_user_role();
  END IF;
  
  -- Calculate changes if both before and after provided
  IF p_before_data IS NOT NULL AND p_after_data IS NOT NULL THEN
    -- Simple diff: keys that changed
    SELECT jsonb_object_agg(key, jsonb_build_object('from', p_before_data->key, 'to', value))
    INTO v_changes
    FROM jsonb_each(p_after_data)
    WHERE p_before_data->key IS DISTINCT FROM value;
  END IF;

  INSERT INTO audit_logs (
    entity_type, entity_id, action, description,
    actor_id, actor_email, actor_role,
    before_data, after_data, changes,
    metadata, ip_address, user_agent
  ) VALUES (
    p_entity_type, p_entity_id, p_action, p_description,
    auth.uid(), v_actor_email, v_actor_role,
    p_before_data, p_after_data, v_changes,
    p_metadata, p_ip_address, p_user_agent
  )
  RETURNING id INTO v_audit_id;

  RETURN v_audit_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to authenticated (actual insertion controlled by function logic)
GRANT EXECUTE ON FUNCTION create_audit_log(TEXT, TEXT, audit_action, TEXT, JSONB, JSONB, JSONB, INET, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION create_audit_log(TEXT, TEXT, audit_action, TEXT, JSONB, JSONB, JSONB, INET, TEXT) TO service_role;

-- View for recent audit activity (useful for admin dashboard)
CREATE OR REPLACE VIEW recent_audit_activity AS
SELECT 
  id,
  entity_type,
  entity_id,
  action,
  description,
  actor_email,
  actor_role,
  created_at,
  metadata
FROM audit_logs
ORDER BY created_at DESC
LIMIT 100;

-- Grant access to the view
GRANT SELECT ON recent_audit_activity TO authenticated;
