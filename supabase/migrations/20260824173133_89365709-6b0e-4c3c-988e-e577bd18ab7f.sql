DROP INDEX IF EXISTS public.partidas_linha_unica;
CREATE UNIQUE INDEX partidas_linha_unica ON public.partidas (origem_id, data, conta, documento, complemento, quantidade, saldo);