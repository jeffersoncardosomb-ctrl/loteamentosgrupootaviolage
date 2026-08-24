import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import type { LinhaImportacao } from './planilhaTipos';

export const listarPartidas = createServerFn({ method: 'GET' })
  .inputValidator((data: { empresaId: string }) => data)
  .handler(async ({ data }) => {
    const { lerPartidasPublicas } = await import('./partidas.server');
    return lerPartidasPublicas(data.empresaId);
  });

export const importarPartidas = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { empresaId: string; linhas: LinhaImportacao[] }) => data)
  .handler(async ({ data, context }) => {
    const { inserirPartidas } = await import('./partidas.server');
    return inserirPartidas(context.supabase, data.empresaId, data.linhas);
  });

export const importarBaseHistorica = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { empresaId: string }) => data)
  .handler(async ({ data, context }) => {
    const { inserirPartidas, baseHistorica } = await import('./partidas.server');
    return inserirPartidas(context.supabase, data.empresaId, await baseHistorica(data.empresaId));
  });

export const souAdmin = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.rpc('is_admin');
    return { admin: data === true };
  });
