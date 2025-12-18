-- Migration: Notifications Infrastructure
-- Email and in-app notifications to relevant teams

CREATE TYPE notification_type AS ENUM (
  'quote_submitted',
  'quote_accepted',
  'quote_rejected',
  'order_placed',
  'order_shipped',
  'distributor_signup',
  'distributor_approved',
  'distributor_rejected',
  'price_change',
  'new_lead',
  'bim_downloaded',
  'low_stock_alert',
  'system_alert',
  'welcome'
);

CREATE TYPE notification_channel AS ENUM (
  'email',
  'in_app',
  'both'
);

CREATE TYPE notification_priority AS ENUM (
  'low',
  'normal',
  'high',
  'urgent'
);

-- Notification templates (admin-configurable)
CREATE TABLE notification_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type notification_type NOT NULL UNIQUE,
  name TEXT NOT NULL,
  subject_template TEXT NOT NULL,        -- Supports {{variable}} placeholders
  body_template TEXT NOT NULL,           -- HTML email body with {{variable}} placeholders
  body_plain TEXT,                       -- Plain text version
  default_channel notification_channel DEFAULT 'both',
  default_priority notification_priority DEFAULT 'normal',
  recipient_roles user_role[] NOT NULL,  -- Which roles receive this notification
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Notification queue/log
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type notification_type NOT NULL,
  
  -- Recipient
  recipient_id UUID REFERENCES auth.users(id),
  recipient_email TEXT,                  -- For non-user recipients or override
  
  -- Content (rendered from template)
  subject TEXT NOT NULL,
  body_html TEXT NOT NULL,
  body_plain TEXT,
  
  -- Delivery
  channel notification_channel NOT NULL,
  priority notification_priority DEFAULT 'normal',
  
  -- Status
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMPTZ,
  email_sent BOOLEAN DEFAULT false,
  email_sent_at TIMESTAMPTZ,
  email_error TEXT,
  
  -- Context
  entity_type TEXT,                      -- 'quote', 'order', etc.
  entity_id TEXT,
  action_url TEXT,                       -- Deep link to relevant page
  metadata JSONB,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_notifications_recipient ON notifications(recipient_id);
CREATE INDEX idx_notifications_type ON notifications(type);
CREATE INDEX idx_notifications_unread ON notifications(recipient_id, is_read) WHERE is_read = false;
CREATE INDEX idx_notifications_pending_email ON notifications(email_sent, created_at) WHERE email_sent = false;
CREATE INDEX idx_notifications_created ON notifications(created_at DESC);

-- Updated_at trigger for templates
CREATE TRIGGER update_notification_templates_updated_at
  BEFORE UPDATE ON notification_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE notification_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Only admins can manage templates
CREATE POLICY "notification_templates_admin" ON notification_templates
  FOR ALL USING (is_admin());

-- Users see their own notifications
CREATE POLICY "notifications_own_select" ON notifications
  FOR SELECT USING (recipient_id = auth.uid());

-- Users can mark their own as read
CREATE POLICY "notifications_own_update" ON notifications
  FOR UPDATE USING (recipient_id = auth.uid())
  WITH CHECK (recipient_id = auth.uid());

-- Staff can view all notifications
CREATE POLICY "notifications_staff_select" ON notifications
  FOR SELECT USING (is_staff());

-- Service role inserts notifications
CREATE POLICY "notifications_service_insert" ON notifications
  FOR INSERT WITH CHECK (true);

-- Function to queue a notification
CREATE OR REPLACE FUNCTION queue_notification(
  p_type notification_type,
  p_recipient_id UUID,
  p_entity_type TEXT DEFAULT NULL,
  p_entity_id TEXT DEFAULT NULL,
  p_variables JSONB DEFAULT '{}',
  p_action_url TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_template notification_templates%ROWTYPE;
  v_notification_id UUID;
  v_subject TEXT;
  v_body_html TEXT;
  v_body_plain TEXT;
  v_recipient_email TEXT;
  v_key TEXT;
  v_value TEXT;
BEGIN
  -- Get template
  SELECT * INTO v_template
  FROM notification_templates
  WHERE type = p_type AND is_active = true;
  
  IF v_template IS NULL THEN
    RAISE WARNING 'No active template for notification type: %', p_type;
    RETURN NULL;
  END IF;
  
  -- Get recipient email
  SELECT email INTO v_recipient_email
  FROM auth.users
  WHERE id = p_recipient_id;
  
  -- Render template (simple variable replacement)
  v_subject := v_template.subject_template;
  v_body_html := v_template.body_template;
  v_body_plain := v_template.body_plain;
  
  FOR v_key, v_value IN SELECT * FROM jsonb_each_text(p_variables)
  LOOP
    v_subject := REPLACE(v_subject, '{{' || v_key || '}}', COALESCE(v_value, ''));
    v_body_html := REPLACE(v_body_html, '{{' || v_key || '}}', COALESCE(v_value, ''));
    IF v_body_plain IS NOT NULL THEN
      v_body_plain := REPLACE(v_body_plain, '{{' || v_key || '}}', COALESCE(v_value, ''));
    END IF;
  END LOOP;
  
  -- Insert notification
  INSERT INTO notifications (
    type, recipient_id, recipient_email,
    subject, body_html, body_plain,
    channel, priority,
    entity_type, entity_id, action_url,
    metadata
  ) VALUES (
    p_type, p_recipient_id, v_recipient_email,
    v_subject, v_body_html, v_body_plain,
    v_template.default_channel, v_template.default_priority,
    p_entity_type, p_entity_id, p_action_url,
    p_variables
  )
  RETURNING id INTO v_notification_id;
  
  RETURN v_notification_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to queue notification for all users with specific roles
CREATE OR REPLACE FUNCTION queue_notification_for_roles(
  p_type notification_type,
  p_roles user_role[],
  p_entity_type TEXT DEFAULT NULL,
  p_entity_id TEXT DEFAULT NULL,
  p_variables JSONB DEFAULT '{}',
  p_action_url TEXT DEFAULT NULL
)
RETURNS INTEGER AS $$
DECLARE
  v_user RECORD;
  v_count INTEGER := 0;
BEGIN
  FOR v_user IN 
    SELECT DISTINCT ur.user_id
    FROM user_roles ur
    WHERE ur.role = ANY(p_roles)
  LOOP
    PERFORM queue_notification(
      p_type, v_user.user_id,
      p_entity_type, p_entity_id,
      p_variables, p_action_url
    );
    v_count := v_count + 1;
  END LOOP;
  
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION queue_notification(notification_type, UUID, TEXT, TEXT, JSONB, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION queue_notification_for_roles(notification_type, user_role[], TEXT, TEXT, JSONB, TEXT) TO service_role;

-- Insert default notification templates
INSERT INTO notification_templates (type, name, subject_template, body_template, body_plain, recipient_roles) VALUES
(
  'quote_submitted',
  'Quote Submitted',
  'New Quote Request: {{reference}}',
  '<h2>New Quote Request</h2><p>A new quote has been submitted.</p><p><strong>Reference:</strong> {{reference}}</p><p><strong>Customer:</strong> {{customer_name}}</p><p><strong>Total:</strong> {{total}}</p>',
  'New Quote Request\n\nReference: {{reference}}\nCustomer: {{customer_name}}\nTotal: {{total}}',
  ARRAY['admin', 'sales']::user_role[]
),
(
  'distributor_signup',
  'New Distributor Signup',
  'New Distributor Application: {{company_name}}',
  '<h2>New Distributor Application</h2><p>A new distributor has applied for an account.</p><p><strong>Company:</strong> {{company_name}}</p><p><strong>Contact:</strong> {{contact_name}}</p><p><strong>Email:</strong> {{email}}</p>',
  'New Distributor Application\n\nCompany: {{company_name}}\nContact: {{contact_name}}\nEmail: {{email}}',
  ARRAY['admin', 'sales']::user_role[]
),
(
  'distributor_approved',
  'Distributor Account Approved',
  'Your Boscotek Distributor Account is Approved',
  '<h2>Welcome to Boscotek</h2><p>Hi {{contact_name}},</p><p>Your distributor account for {{company_name}} has been approved.</p><p>You can now log in and access distributor pricing.</p>',
  'Welcome to Boscotek\n\nHi {{contact_name}},\n\nYour distributor account for {{company_name}} has been approved.\n\nYou can now log in and access distributor pricing.',
  ARRAY['distributor']::user_role[]
),
(
  'new_lead',
  'New BIM Lead',
  'New BIM Download Lead: {{name}}',
  '<h2>New BIM Lead</h2><p>Someone downloaded BIM files.</p><p><strong>Name:</strong> {{name}}</p><p><strong>Email:</strong> {{email}}</p><p><strong>Company:</strong> {{company}}</p><p><strong>Project:</strong> {{project_name}}</p>',
  'New BIM Lead\n\nName: {{name}}\nEmail: {{email}}\nCompany: {{company}}\nProject: {{project_name}}',
  ARRAY['admin', 'sales']::user_role[]
);
