DROP POLICY IF EXISTS "admin altera partidas" ON public.partidas;
DROP POLICY IF EXISTS "admin insere partidas" ON public.partidas;
DROP POLICY IF EXISTS "admin remove partidas" ON public.partidas;

CREATE POLICY "admin insere partidas" ON public.partidas FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL AND (
    EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin')
    OR lower(coalesce(auth.jwt() ->> 'email', '')) = 'jeffersoncardosomb@gmail.com'
  )
);

CREATE POLICY "admin altera partidas" ON public.partidas FOR UPDATE TO authenticated
USING (
  auth.uid() IS NOT NULL AND (
    EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin')
    OR lower(coalesce(auth.jwt() ->> 'email', '')) = 'jeffersoncardosomb@gmail.com'
  )
)
WITH CHECK (
  auth.uid() IS NOT NULL AND (
    EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin')
    OR lower(coalesce(auth.jwt() ->> 'email', '')) = 'jeffersoncardosomb@gmail.com'
  )
);

CREATE POLICY "admin remove partidas" ON public.partidas FOR DELETE TO authenticated
USING (
  auth.uid() IS NOT NULL AND (
    EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin')
    OR lower(coalesce(auth.jwt() ->> 'email', '')) = 'jeffersoncardosomb@gmail.com'
  )
);

REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO service_role;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO service_role;