CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "usuario ve seus proprios papeis" ON public.user_roles
FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL AND (
    public.has_role(auth.uid(), 'admin')
    OR lower(coalesce(auth.jwt() ->> 'email', '')) = 'jeffersoncardosomb@gmail.com'
  )
$$;

CREATE TABLE public.partidas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  origem_id text NOT NULL DEFAULT '',
  data date NOT NULL,
  conta text NOT NULL,
  conta_nome text NOT NULL DEFAULT '',
  documento text NOT NULL DEFAULT '',
  complemento text NOT NULL DEFAULT '',
  quantidade numeric NOT NULL DEFAULT 0,
  saldo numeric NOT NULL DEFAULT 0,
  criado_em timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX partidas_linha_unica ON public.partidas (data, conta, documento, complemento, quantidade, saldo);
CREATE INDEX partidas_data_idx ON public.partidas (data);

GRANT SELECT ON public.partidas TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.partidas TO authenticated;
GRANT ALL ON public.partidas TO service_role;
ALTER TABLE public.partidas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "leitura publica das partidas" ON public.partidas
FOR SELECT USING (true);

CREATE POLICY "admin insere partidas" ON public.partidas
FOR INSERT TO authenticated WITH CHECK (public.is_admin());

CREATE POLICY "admin altera partidas" ON public.partidas
FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "admin remove partidas" ON public.partidas
FOR DELETE TO authenticated USING (public.is_admin());