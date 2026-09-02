CREATE OR REPLACE FUNCTION public.grant_admin_for_verified_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF new.email_confirmed_at IS NOT NULL
     AND lower(new.email) = 'contabilidade@otaviolage.com' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (new.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN new;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.grant_admin_for_verified_email() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.grant_admin_for_verified_email() TO service_role;

CREATE TRIGGER on_auth_user_created_grant_admin_otaviolage
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.grant_admin_for_verified_email();

CREATE TRIGGER on_auth_user_confirmed_grant_admin_otaviolage
AFTER UPDATE OF email_confirmed_at ON auth.users
FOR EACH ROW
WHEN (old.email_confirmed_at IS NULL AND new.email_confirmed_at IS NOT NULL)
EXECUTE FUNCTION public.grant_admin_for_verified_email();