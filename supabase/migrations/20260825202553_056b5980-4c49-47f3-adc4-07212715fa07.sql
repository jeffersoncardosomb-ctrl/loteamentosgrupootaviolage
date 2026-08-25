CREATE POLICY "admin le partidas" ON public.partidas
  FOR SELECT TO authenticated
  USING (
    auth.uid() IS NOT NULL AND (
      EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin')
      OR lower(coalesce(auth.jwt() ->> 'email', '')) = 'jeffersoncardosomb@gmail.com'
    )
  );