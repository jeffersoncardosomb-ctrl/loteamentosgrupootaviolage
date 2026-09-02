import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useCallback, useEffect, useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { supabase } from '@/integrations/supabase/client';
import { lerPlanilha } from '@/lib/planilha';
import { EMPRESA_PADRAO, EMPRESAS, empresaPorId } from '@/lib/empresas';
import {
  importarBaseHistorica,
  importarPartidas,
  listarAcessos,
  regenerarAcesso,
  souAdmin,
} from '@/lib/partidas.functions';


const title = 'Enviar base contábil — Painel LAGE';
const description = 'Envio mensal da planilha de lançamentos que alimenta o Painel LAGE.';

export const Route = createFileRoute('/_authenticated/upload')({
  head: () => ({
    meta: [
      { title },
      { name: 'description', content: description },
      { name: 'robots', content: 'noindex' },
      { property: 'og:title', content: title },
      { property: 'og:description', content: description },
    ],
  }),
  component: UploadPage,
});

interface Resumo {
  recebidas: number;
  duplicadasNoArquivo: number;
  inseridas: number;
  jaExistiam: number;
}

function UploadPage() {
  const navigate = useNavigate();
  const verificar = useServerFn(souAdmin);
  const enviar = useServerFn(importarPartidas);
  const importarBase = useServerFn(importarBaseHistorica);

  const [admin, setAdmin] = useState<boolean | null>(null);
  const [empresaId, setEmpresaId] = useState(EMPRESA_PADRAO.id);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [resumo, setResumo] = useState<Resumo | null>(null);

  useEffect(() => {
    verificar()
      .then((r) => setAdmin(r.admin))
      .catch(() => setAdmin(false));
  }, [verificar]);

  async function sair() {
    await supabase.auth.signOut();
    navigate({ to: '/', replace: true });
  }

  async function processar() {
    if (!arquivo) return;
    setOcupado(true);
    setErro(null);
    setResumo(null);
    try {
      const { linhas, ignoradas, colunasFaltando } = await lerPlanilha(arquivo);
      if (colunasFaltando.length > 0) {
        throw new Error(`Colunas ausentes na planilha: ${colunasFaltando.join(', ')}.`);
      }
      if (linhas.length === 0) throw new Error('Nenhuma linha válida encontrada.');
      const r = await enviar({ data: { empresaId, linhas } });
      setResumo(r);
      if (ignoradas > 0) {
        setErro(`${ignoradas} linha(s) sem data ou sem conta foram ignoradas.`);
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao importar a planilha.');
    } finally {
      setOcupado(false);
    }
  }

  async function historico() {
    setOcupado(true);
    setErro(null);
    setResumo(null);
    try {
      setResumo(await importarBase({ data: { empresaId } }));
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao importar a base histórica.');
    } finally {
      setOcupado(false);
    }
  }

  if (admin === null) {
    return <p className="p-8 text-sm text-muted-foreground">Carregando…</p>;
  }

  if (!admin) {
    return (
      <div className="mx-auto max-w-lg p-8">
        <h1 className="text-xl font-semibold text-foreground">Acesso restrito</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Esta área é exclusiva do administrador do painel.
        </p>
        <div className="mt-4 flex gap-3">
          <Link to="/" className="text-sm underline">Voltar ao painel</Link>
          <button type="button" onClick={sair} className="text-sm underline">Sair</button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-foreground">Atualizar base contábil</h1>
        <div className="flex items-center gap-3">
          <Link to="/usuarios" className="text-sm underline">Aprovação de usuários</Link>
          <button type="button" onClick={sair} className="text-sm underline">Sair</button>
        </div>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        Envie a planilha no mesmo formato da extração atual (colunas DATA, CONTA_CONTABIL,
        NOMEPRODUTO, DOCUMENTO, COMPLEMENTO, QUANTIDADE e SALDO). Lançamentos idênticos que
        já estejam na base são ignorados — pode reenviar o arquivo do mês sem medo.
      </p>

      <label className="mt-4 block text-sm font-medium text-foreground">
        Empresa
        <select
          value={empresaId}
          onChange={(e) => setEmpresaId(e.target.value)}
          className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
        >
          {EMPRESAS.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
        </select>
      </label>

      <div className="mt-6 rounded-xl border border-border bg-card p-5">
        <input
          type="file"
          accept=".xlsx,.xls"
          onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
          className="block w-full text-sm text-foreground"
        />
        <button
          type="button"
          onClick={processar}
          disabled={!arquivo || ocupado}
          className="mt-4 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
        >
          {ocupado ? 'Importando…' : 'Importar planilha'}
        </button>
      </div>

      <div className="mt-4 rounded-xl border border-border bg-card p-5">
        <h2 className="text-sm font-semibold text-foreground">Base histórica</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Carrega os lançamentos que já acompanham o painel para a empresa selecionada.
          Rodar mais de uma vez não duplica nada.
        </p>
        <button
          type="button"
          onClick={historico}
          disabled={ocupado}
          className="mt-3 rounded-md border border-input px-4 py-2 text-sm font-medium text-foreground disabled:opacity-60"
        >
          Importar base histórica
        </button>
      </div>

      <LinksDosSocios />


      {erro && <p className="mt-4 text-sm text-destructive">{erro}</p>}

      {resumo && (
        <div className="mt-4 rounded-xl border border-border bg-card p-5 text-sm text-foreground">
          <p><strong>{resumo.inseridas}</strong> lançamento(s) incluído(s).</p>
          <p className="text-muted-foreground">
            {resumo.recebidas} lidos · {resumo.jaExistiam} já existiam ·{' '}
            {resumo.duplicadasNoArquivo} repetidos no próprio arquivo.
          </p>
          <Link to="/" className="mt-3 inline-block underline">Ver o painel</Link>
        </div>
      )}
    </div>
  );
}

interface Acesso {
  empresa_id: string;
  token: string;
  atualizado_em: string;
}

function LinksDosSocios() {
  const carregar = useServerFn(listarAcessos);
  const regenerar = useServerFn(regenerarAcesso);
  const [acessos, setAcessos] = useState<Acesso[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [copiado, setCopiado] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);

  const buscar = useCallback(() => {
    carregar()
      .then((r) => setAcessos(r as Acesso[]))
      .catch((e) => setErro(e instanceof Error ? e.message : 'Falha ao carregar os links.'));
  }, [carregar]);

  useEffect(buscar, [buscar]);

  const url = (token: string) =>
    `${typeof window === 'undefined' ? '' : window.location.origin}/p/${token}`;

  async function copiar(token: string) {
    await navigator.clipboard.writeText(url(token));
    setCopiado(token);
    setTimeout(() => setCopiado(null), 2000);
  }

  async function novo(empresaId: string) {
    if (!window.confirm('Gerar um novo código? O link atual deixa de funcionar imediatamente.')) {
      return;
    }
    setOcupado(empresaId);
    try {
      await regenerar({ data: { empresaId } });
      buscar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao gerar o novo código.');
    } finally {
      setOcupado(null);
    }
  }

  return (
    <div className="mt-4 rounded-xl border border-border bg-card p-5">
      <h2 className="text-sm font-semibold text-foreground">Links dos sócios</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Cada empresa tem um endereço próprio e secreto. Quem abre o link vê apenas o painel
        daquela empresa, sem seletor e sem acesso à área do administrador.
      </p>

      {erro && <p className="mt-3 text-sm text-destructive">{erro}</p>}
      {!acessos && !erro && <p className="mt-3 text-sm text-muted-foreground">Carregando…</p>}

      <ul className="mt-3 space-y-3">
        {(acessos ?? []).map((a) => (
          <li key={a.empresa_id} className="rounded-lg border border-border p-3">
            <p className="text-sm font-medium text-foreground">
              {empresaPorId(a.empresa_id).apelido}
            </p>
            <p className="mt-1 break-all font-mono text-xs text-muted-foreground">
              {url(a.token)}
            </p>
            <div className="mt-2 flex gap-3">
              <button
                type="button"
                onClick={() => copiar(a.token)}
                className="rounded-md border border-input px-3 py-1.5 text-xs font-medium text-foreground"
              >
                {copiado === a.token ? 'Copiado!' : 'Copiar link'}
              </button>
              <button
                type="button"
                onClick={() => novo(a.empresa_id)}
                disabled={ocupado === a.empresa_id}
                className="rounded-md border border-input px-3 py-1.5 text-xs font-medium text-foreground disabled:opacity-60"
              >
                {ocupado === a.empresa_id ? 'Gerando…' : 'Gerar novo código'}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
