-- Fix SECURITY DEFINER views flagged by Supabase linter
-- These views should use SECURITY INVOKER to respect RLS policies

-- 1. Fix recent_audit_activity view
DROP VIEW IF EXISTS recent_audit_activity;
CREATE VIEW recent_audit_activity 
WITH (security_invoker = true) AS
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

GRANT SELECT ON recent_audit_activity TO authenticated;

-- 2. Fix pricing_analytics view
DROP VIEW IF EXISTS pricing_analytics;
CREATE VIEW pricing_analytics 
WITH (security_invoker = true) AS
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

-- 3. Fix pricing_tier_summary view
DROP VIEW IF EXISTS pricing_tier_summary;
CREATE VIEW pricing_tier_summary 
WITH (security_invoker = true) AS
SELECT 
  pt.id,
  pt.name,
  pt.code,
  pt.markup_percentage,
  pt.description,
  pt.is_active,
  pt.is_public_default,
  COUNT(d.id) as distributor_count
FROM pricing_tiers pt
LEFT JOIN distributors d ON d.pricing_tier_id = pt.id AND d.is_active = true
GROUP BY pt.id, pt.name, pt.code, pt.markup_percentage, pt.description, pt.is_active, pt.is_public_default
ORDER BY pt.sort_order;

GRANT SELECT ON pricing_tier_summary TO authenticated;

-- Add comment
COMMENT ON VIEW recent_audit_activity IS 'Recent audit log entries for admin dashboard (respects RLS)';
COMMENT ON VIEW pricing_analytics IS '30-day pricing request analytics (respects RLS)';
COMMENT ON VIEW pricing_tier_summary IS 'Pricing tier summary with distributor counts (respects RLS)';
