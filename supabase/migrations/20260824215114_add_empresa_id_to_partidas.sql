ALTER TABLE public.partidas
  ADD COLUMN empresa_id text NOT NULL DEFAULT 'serra-bonita';

DROP INDEX IF EXISTS public.partidas_linha_unica;
CREATE UNIQUE INDEX partidas_linha_unica ON public.partidas
  (empresa_id, origem_id, data, conta, documento, complemento, quantidade, saldo);

CREATE INDEX partidas_empresa_idx ON public.partidas (empresa_id);
