import { createFileRoute, Link } from '@tanstack/react-router';
import { useCallback, useEffect, useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import {
  definirPapel,
  listarUsuarios,
  type UsuarioAdmin,
} from '@/lib/usuarios.functions';

const title = 'Aprovação de usuários — Painel LAGE';
const description = 'Liberação e revogação de acesso das contas cadastradas no Painel LAGE.';

export const Route = createFileRoute('/_authenticated/usuarios')({
  head: () => ({
    meta: [
      { title },
      { name: 'description', content: description },
      { name: 'robots', content: 'noindex' },
      { property: 'og:title', content: title },
      { property: 'og:description', content: description },
      { property: 'og:type', content: 'website' },
      { name: 'twitter:card', content: 'summary' },
    ],
  }),
  component: UsuariosPage,
});

const dataHora = (v: string | null) =>
  v ? new Date(v).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—';

function rotulo(u: UsuarioAdmin) {
  if (u.fixo || u.papel === 'admin') return { texto: 'Administrador', cor: 'text-primary' };
  if (u.papel === 'user') return { texto: 'Aprovado', cor: 'text-foreground' };
  return { texto: 'Pendente', cor: 'text-destructive' };
}

function UsuariosPage() {
  const carregar = useServerFn(listarUsuarios);
  const salvar = useServerFn(definirPapel);

  const [usuarios, setUsuarios] = useState<UsuarioAdmin[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);

  const buscar = useCallback(() => {
    setErro(null);
    carregar()
      .then((r) => setUsuarios(r as UsuarioAdmin[]))
      .catch((e) =>
        setErro(e instanceof Error ? e.message : 'Falha ao carregar os usuários.'),
      );
  }, [carregar]);

  useEffect(buscar, [buscar]);

  async function alterar(userId: string, papel: 'admin' | 'user' | null) {
    setOcupado(userId);
    setErro(null);
    try {
      await salvar({ data: { userId, papel } });
      buscar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao atualizar o acesso.');
    } finally {
      setOcupado(null);
    }
  }

  const pendentes = (usuarios ?? []).filter((u) => !u.fixo && u.papel === null).length;

  return (
    <div className="mx-auto max-w-3xl p-8">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold text-foreground">Aprovação de usuários</h1>
        <Link to="/upload" className="text-sm underline">Base contábil</Link>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        Contas criadas pelo cadastro ficam pendentes até você liberar. Aprovados enxergam o
        painel; administradores também acessam o envio de base e os links dos sócios.
        {pendentes > 0 && ` Há ${pendentes} conta(s) aguardando aprovação.`}
      </p>

      {erro && <p className="mt-4 text-sm text-destructive">{erro}</p>}
      {!usuarios && !erro && (
        <p className="mt-4 text-sm text-muted-foreground">Carregando…</p>
      )}

      <ul className="mt-6 space-y-3">
        {(usuarios ?? []).map((u) => {
          const marca = rotulo(u);
          return (
            <li key={u.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-foreground">{u.email || '(sem e-mail)'}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Cadastro {dataHora(u.criadoEm)} · Último acesso {dataHora(u.ultimoAcesso)}
                  </p>
                </div>
                <span className={`text-xs font-semibold ${marca.cor}`}>{marca.texto}</span>
              </div>

              {u.fixo ? (
                <p className="mt-3 text-xs text-muted-foreground">
                  Administrador principal — não pode ter o acesso alterado por aqui.
                </p>
              ) : (
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={ocupado === u.id || u.papel === 'user'}
                    onClick={() => alterar(u.id, 'user')}
                    className="rounded-md border border-input px-3 py-1.5 text-xs font-medium text-foreground disabled:opacity-50"
                  >
                    Aprovar como usuário
                  </button>
                  <button
                    type="button"
                    disabled={ocupado === u.id || u.papel === 'admin'}
                    onClick={() => alterar(u.id, 'admin')}
                    className="rounded-md border border-input px-3 py-1.5 text-xs font-medium text-foreground disabled:opacity-50"
                  >
                    Tornar administrador
                  </button>
                  <button
                    type="button"
                    disabled={ocupado === u.id || u.papel === null}
                    onClick={() => alterar(u.id, null)}
                    className="rounded-md border border-destructive px-3 py-1.5 text-xs font-medium text-destructive disabled:opacity-50"
                  >
                    Revogar acesso
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
