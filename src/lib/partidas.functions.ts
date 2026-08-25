import { createServerFn } from '@tanstack/react-start';
import { notFound } from '@tanstack/react-router';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import type { LinhaImportacao } from './planilhaTipos';

const EMAIL_ADMIN = 'jeffersoncardosomb@gmail.com';

/**
 * Checagem de administrador feita com o cliente do próprio usuário: o papel
 * vem da tabela user_roles (RLS deixa cada um ver só os seus) ou do e-mail
 * do administrador no token.
 */
async function ehAdmin(context: {
  supabase: { from: (t: 'user_roles') => any };
  claims: Record<string, unknown>;
}) {
  const email = String(context.claims['email'] ?? '').toLowerCase();
  if (email === EMAIL_ADMIN) return true;
  const { data } = await context.supabase
    .from('user_roles')
    .select('role')
    .eq('role', 'admin')
    .limit(1);
  return Array.isArray(data) && data.length > 0;
}

async function exigirAdmin(context: Parameters<typeof ehAdmin>[0]) {
  if (!(await ehAdmin(context))) throw new Error('Acesso restrito ao administrador.');
}


/** Painel do administrador: base completa de uma empresa. */
export const listarPartidas = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { empresaId: string }) => data)
  .handler(async ({ data, context }) => {
    await exigirAdmin(context);
    const { lerPartidasPublicas } = await import('./partidas.server');
    return lerPartidasPublicas(data.empresaId);
  });

/** Link secreto do sócio: resolve o código e devolve só a empresa dele. */
export const listarPartidasPorToken = createServerFn({ method: 'GET' })
  .inputValidator((data: { token: string }) => data)
  .handler(async ({ data }) => {
    const { empresaPorToken, lerPartidasPublicas } = await import('./partidas.server');
    const empresaId = await empresaPorToken(data.token);
    if (!empresaId) throw notFound();
    return { empresaId, partidas: await lerPartidasPublicas(empresaId) };
  });

export const listarAcessos = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await exigirAdmin(context);
    const { listarAcessosDb } = await import('./partidas.server');
    return listarAcessosDb();
  });

export const regenerarAcesso = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { empresaId: string }) => data)
  .handler(async ({ data, context }) => {
    await exigirAdmin(context);
    const { regenerarTokenDb } = await import('./partidas.server');
    return regenerarTokenDb(data.empresaId);
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
