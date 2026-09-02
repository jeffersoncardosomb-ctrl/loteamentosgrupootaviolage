import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { EMAIL_ADMIN, exigirAdmin } from './admin-guard';

export interface UsuarioAdmin {
  id: string;
  email: string;
  criadoEm: string;
  ultimoAcesso: string | null;
  papel: 'admin' | 'user' | null;
  fixo: boolean;
}

/** Lista todas as contas cadastradas com o papel atual de cada uma. */
export const listarUsuarios = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<UsuarioAdmin[]> => {
    await exigirAdmin(context);
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');

    const { data: lista, error } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 200,
    });
    if (error) throw new Error(error.message);

    const { data: papeis, error: erroPapeis } = await supabaseAdmin
      .from('user_roles')
      .select('user_id, role');
    if (erroPapeis) throw new Error(erroPapeis.message);

    const porUsuario = new Map((papeis ?? []).map((p) => [p.user_id, p.role]));

    return lista.users
      .map((u) => {
        const email = (u.email ?? '').toLowerCase();
        return {
          id: u.id,
          email,
          criadoEm: u.created_at,
          ultimoAcesso: u.last_sign_in_at ?? null,
          papel: (porUsuario.get(u.id) as 'admin' | 'user' | undefined) ?? null,
          fixo: email === EMAIL_ADMIN,
        };
      })
      .sort((a, b) => a.criadoEm.localeCompare(b.criadoEm));
  });

/** Define, troca ou remove o papel de uma conta. */
export const definirPapel = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { userId: string; papel: 'admin' | 'user' | null }) => {
    if (!data.userId) throw new Error('Usuário inválido.');
    if (data.papel !== null && data.papel !== 'admin' && data.papel !== 'user') {
      throw new Error('Papel inválido.');
    }
    return data;
  })
  .handler(async ({ data, context }) => {
    await exigirAdmin(context);
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');

    const { error: erroLimpeza } = await supabaseAdmin
      .from('user_roles')
      .delete()
      .eq('user_id', data.userId);
    if (erroLimpeza) throw new Error(erroLimpeza.message);

    if (data.papel) {
      const { error } = await supabaseAdmin
        .from('user_roles')
        .insert({ user_id: data.userId, role: data.papel });
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });
