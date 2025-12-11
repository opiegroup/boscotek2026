-- Check current RLS policies
SELECT 
  schemaname, 
  tablename, 
  policyname, 
  cmd::text as command,
  roles::text as roles,
  qual::text as using_expression,
  with_check::text as check_expression
FROM pg_policies 
WHERE tablename IN ('bim_leads', 'configurations', 'export_analytics', 'bim_exports') 
ORDER BY tablename, policyname;
