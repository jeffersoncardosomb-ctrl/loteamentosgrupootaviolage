import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import type { LinhaImportacao } from './planilhaTipos';

export const listarPartidas = createServerFn({ method: 'GET' }).handler(async () => {
  const { lerPartidasPublicas } = await import('./partidas.server');
  return lerPartidasPublicas();
});

export const importarPartidas = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { linhas: LinhaImportacao[] }) => data)
  .handler(async ({ data, context }) => {
    const { inserirPartidas } = await import('./partidas.server');
    return inserirPartidas(context.supabase, data.linhas);
  });

export const importarBaseHistorica = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { inserirPartidas, baseHistorica } = await import('./partidas.server');
    return inserirPartidas(context.supabase, await baseHistorica());
  });

export const souAdmin = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.rpc('is_admin');
    return { admin: data === true };
  });
