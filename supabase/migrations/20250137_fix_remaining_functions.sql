-- =============================================================================
-- Fix Remaining Function Search Path Warnings
-- These functions need to be recreated with SET search_path = ''
-- =============================================================================

-- 1. has_role - drop and recreate
DROP FUNCTION IF EXISTS public.has_role(TEXT);
CREATE FUNCTION public.has_role(required_role TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role::TEXT = required_role
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

GRANT EXECUTE ON FUNCTION public.has_role(TEXT) TO authenticated;

-- 2. has_any_role - drop and recreate
DROP FUNCTION IF EXISTS public.has_any_role(TEXT[]);
CREATE FUNCTION public.has_any_role(required_roles TEXT[])
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role::TEXT = ANY(required_roles)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

GRANT EXECUTE ON FUNCTION public.has_any_role(TEXT[]) TO authenticated;

-- 3. queue_notification - drop and recreate
DROP FUNCTION IF EXISTS public.queue_notification(UUID, TEXT, TEXT, TEXT, JSONB);
DROP FUNCTION IF EXISTS public.queue_notification(UUID, TEXT, TEXT, TEXT);
CREATE FUNCTION public.queue_notification(
  p_user_id UUID,
  p_type TEXT,
  p_title TEXT,
  p_message TEXT,
  p_metadata JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_notification_id UUID;
BEGIN
  INSERT INTO public.notifications (user_id, type, title, message, metadata)
  VALUES (p_user_id, p_type, p_title, p_message, p_metadata)
  RETURNING id INTO v_notification_id;
  
  RETURN v_notification_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

GRANT EXECUTE ON FUNCTION public.queue_notification(UUID, TEXT, TEXT, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.queue_notification(UUID, TEXT, TEXT, TEXT, JSONB) TO service_role;

-- 4. queue_notification_for_roles - drop and recreate
DROP FUNCTION IF EXISTS public.queue_notification_for_roles(TEXT[], TEXT, TEXT, TEXT, JSONB);
DROP FUNCTION IF EXISTS public.queue_notification_for_roles(TEXT[], TEXT, TEXT, TEXT);
CREATE FUNCTION public.queue_notification_for_roles(
  p_roles TEXT[],
  p_type TEXT,
  p_title TEXT,
  p_message TEXT,
  p_metadata JSONB DEFAULT NULL
)
RETURNS INT AS $$
DECLARE
  v_count INT := 0;
BEGIN
  INSERT INTO public.notifications (user_id, type, title, message, metadata)
  SELECT ur.user_id, p_type, p_title, p_message, p_metadata
  FROM public.user_roles ur
  WHERE ur.role::TEXT = ANY(p_roles);
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

GRANT EXECUTE ON FUNCTION public.queue_notification_for_roles(TEXT[], TEXT, TEXT, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.queue_notification_for_roles(TEXT[], TEXT, TEXT, TEXT, JSONB) TO service_role;

-- 5. update_user_profile - drop and recreate
DROP FUNCTION IF EXISTS public.update_user_profile(TEXT, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.update_user_profile();
CREATE FUNCTION public.update_user_profile(
  p_full_name TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL,
  p_company TEXT DEFAULT NULL,
  p_job_title TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE public.user_profiles
  SET
    full_name = COALESCE(p_full_name, full_name),
    phone = COALESCE(p_phone, phone),
    company = COALESCE(p_company, company),
    job_title = COALESCE(p_job_title, job_title),
    updated_at = NOW()
  WHERE user_id = auth.uid();
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

GRANT EXECUTE ON FUNCTION public.update_user_profile(TEXT, TEXT, TEXT, TEXT) TO authenticated;
