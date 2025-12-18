-- Migration: Pricing Logs
-- Tracks all pricing calculations for analytics and debugging

CREATE TABLE pricing_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  product_id TEXT NOT NULL,
  request_data JSONB NOT NULL,
  response_total NUMERIC NOT NULL,
  user_role TEXT,
  session_id TEXT,
  ip_address INET,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for analytics queries
CREATE INDEX idx_pricing_logs_user ON pricing_logs(user_id);
CREATE INDEX idx_pricing_logs_product ON pricing_logs(product_id);
CREATE INDEX idx_pricing_logs_created ON pricing_logs(created_at DESC);
CREATE INDEX idx_pricing_logs_role ON pricing_logs(user_role);

-- Partitioning hint: Consider partitioning by month if volume grows
-- For now, simple index-based approach

-- RLS - pricing logs are service-only write, staff-only read
ALTER TABLE pricing_logs ENABLE ROW LEVEL SECURITY;

-- Staff can view pricing logs
CREATE POLICY "pricing_logs_staff_select" ON pricing_logs
  FOR SELECT USING (
    has_any_role(ARRAY['admin'::user_role, 'pricing_manager'::user_role, 'sales'::user_role])
  );

-- Service role inserts (via Edge Function)
CREATE POLICY "pricing_logs_service_insert" ON pricing_logs
  FOR INSERT WITH CHECK (true);

-- View for pricing analytics
CREATE OR REPLACE VIEW pricing_analytics AS
SELECT 
  DATE_TRUNC('day', created_at) AS day,
  product_id,
  user_role,
  COUNT(*) AS request_count,
  AVG(response_total) AS avg_price,
  MIN(response_total) AS min_price,
  MAX(response_total) AS max_price
FROM pricing_logs
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY DATE_TRUNC('day', created_at), product_id, user_role
ORDER BY day DESC, request_count DESC;

GRANT SELECT ON pricing_analytics TO authenticated;
