import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { lovable } from '@/integrations/lovable';

const title = 'Acesso administrativo — Painel LAGE';
const description = 'Área restrita para envio da base contábil mensal do Painel LAGE.';

export const Route = createFileRoute('/auth')({
  head: () => ({
    meta: [
      { title },
      { name: 'description', content: description },
      { name: 'robots', content: 'noindex' },
      { property: 'og:title', content: title },
      { property: 'og:description', content: description },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [modo, setModo] = useState<'entrar' | 'criar'>('entrar');
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setAviso(null);
    setCarregando(true);
    try {
      if (modo === 'entrar') {
        const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
        if (error) throw error;
        navigate({ to: '/upload' });
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password: senha,
          options: { emailRedirectTo: `${window.location.origin}/upload` },
        });
        if (error) throw error;
        setAviso('Conta criada. Se for pedida confirmação, verifique seu e-mail.');
      }
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível entrar.');
    } finally {
      setCarregando(false);
    }
  }

  async function google() {
    setErro(null);
    const result = await lovable.auth.signInWithOAuth('google', {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      setErro('Não foi possível entrar com Google.');
      return;
    }
    if (result.redirected) return;
    navigate({ to: '/upload' });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-foreground">Acesso administrativo</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Área restrita para atualizar a base do painel.
        </p>

        <form onSubmit={enviar} className="mt-6 space-y-3">
          <input
            type="email" required placeholder="E-mail" value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
          />
          <input
            type="password" required minLength={6} placeholder="Senha" value={senha}
            onChange={(e) => setSenha(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
          />
          <button
            type="submit" disabled={carregando}
            className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
          >
            {modo === 'entrar' ? 'Entrar' : 'Criar conta'}
          </button>
        </form>

        <button
          type="button" onClick={google}
          className="mt-3 w-full rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground"
        >
          Entrar com Google
        </button>

        {erro && <p className="mt-3 text-sm text-destructive">{erro}</p>}
        {aviso && <p className="mt-3 text-sm text-muted-foreground">{aviso}</p>}

        <button
          type="button"
          onClick={() => setModo(modo === 'entrar' ? 'criar' : 'entrar')}
          className="mt-4 text-sm text-muted-foreground underline"
        >
          {modo === 'entrar' ? 'Ainda não tenho conta' : 'Já tenho conta'}
        </button>
      </div>
    </div>
  );
}
