export const EMAIL_ADMIN = 'jeffersoncardosomb@gmail.com';

/**
 * Checagem de administrador feita com o cliente do próprio usuário: o papel
 * vem da tabela user_roles (RLS deixa cada um ver só os seus) ou do e-mail
 * do administrador no token.
 */
export async function ehAdmin(context: {
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

export async function exigirAdmin(context: Parameters<typeof ehAdmin>[0]) {
  if (!(await ehAdmin(context))) throw new Error('Acesso restrito ao administrador.');
}
