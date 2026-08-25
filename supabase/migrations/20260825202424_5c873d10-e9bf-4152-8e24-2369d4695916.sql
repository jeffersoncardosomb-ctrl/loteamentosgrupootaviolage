CREATE TABLE public.empresa_acesso (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id text NOT NULL UNIQUE,
  token text NOT NULL UNIQUE,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.empresa_acesso TO authenticated;
GRANT ALL ON public.empresa_acesso TO service_role;

ALTER TABLE public.empresa_acesso ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin gerencia acessos" ON public.empresa_acesso
  FOR ALL TO authenticated
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

CREATE OR REPLACE FUNCTION public.set_atualizado_em()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.atualizado_em = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER empresa_acesso_atualizado_em
  BEFORE UPDATE ON public.empresa_acesso
  FOR EACH ROW EXECUTE FUNCTION public.set_atualizado_em();

INSERT INTO public.empresa_acesso (empresa_id, token) VALUES
  ('serra-bonita', encode(gen_random_bytes(32), 'hex')),
  ('parque-das-estrelas', encode(gen_random_bytes(32), 'hex'));

DROP POLICY IF EXISTS "leitura publica das partidas" ON public.partidas;
REVOKE SELECT ON public.partidas FROM anon;