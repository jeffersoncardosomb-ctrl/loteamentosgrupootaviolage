import { useMemo, useState } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { EMPRESAS, empresaPorId } from './lib/empresas';
import { fimDoMes } from './lib/contasPagar';
import { conferirIntegridade, prepararPartidas } from './lib/dados';
import type { Partida } from './lib/types';
import { BalanceteFinanceiro } from './pages/BalanceteFinanceiro';
import { ContasPagasEPagar } from './pages/ContasPagasEPagar';
import { Aportes } from './pages/Aportes';
import { Resumo } from './pages/Resumo';
import { brl } from './lib/contasPagar';
import logoLage from './assets/logo-lage.jpg.asset.json';

const ABAS = ['Balancete Financeiro', 'Contas Pagas e a Pagar', 'Aportes'] as const;
type Aba = (typeof ABAS)[number];

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

export default function App({ base, empresaId, empresaFixa = false }: { base: Partida[]; empresaId: string; empresaFixa?: boolean }) {
  const navigate = useNavigate();
  const empresa = useMemo(() => empresaPorId(empresaId), [empresaId]);
  const todos = useMemo(() => prepararPartidas(base, empresa), [base, empresa]);
  const integridade = useMemo(() => conferirIntegridade(todos), [todos]);

  const [aba, setAba] = useState<Aba>('Contas Pagas e a Pagar');
  const [ano, setAno] = useState('todos');
  const [mes, setMes] = useState('todos');
  const [resumo, setResumo] = useState(false);

  /** Anos disponíveis mudam por empresa, então troca de empresa reseta o filtro. */
  const trocarEmpresa = (id: string) => {
    setAno('todos');
    setMes('todos');
    navigate({ to: '/', search: { empresa: id } });
  };

  const anos = useMemo(
    () => [...new Set(todos.map((p) => p.data.slice(0, 4)))].sort(),
    [todos],
  );

  const partidas = useMemo(
    () => todos.filter((p) => {
      if (ano !== 'todos' && p.data.slice(0, 4) !== ano) return false;
      if (mes !== 'todos' && p.data.slice(5, 7) !== mes) return false;
      return true;
    }),
    [todos, ano, mes],
  );

  /** Data de referência das posições de saldo. */
  const corte = useMemo(() => {
    if (ano === 'todos') return todos.reduce((a, p) => (p.data > a ? p.data : a), '0000-00-00');
    if (mes === 'todos') return `${ano}-12-31`;
    return fimDoMes(`${ano}-${mes}`);
  }, [todos, ano, mes]);

  /** Início do período selecionado, para saldo inicial de caixa. Nulo quando o período é "todos". */
  const inicioPeriodo = useMemo(() => {
    if (ano === 'todos') return null;
    if (mes === 'todos') return `${ano}-01-01`;
    return `${ano}-${mes}-01`;
  }, [ano, mes]);

  return (
    <div className="app">
     <div className="cabecalho-fixo">
      <header className="topo">
        <div className="marca">
          <img className="marca__logo" src={logoLage.url} alt="Grupo Otávio Lage" />
        </div>

        <div className="filtros">
          {empresaFixa ? (
            <div className="filtro">
              <span>Empresa</span>
              <strong className="filtro__valor">{empresa.apelido}</strong>
            </div>
          ) : (
            <label className="filtro">
              <span>Empresa</span>
              <select value={empresa.id} onChange={(e) => trocarEmpresa(e.target.value)}>
                {EMPRESAS.map((e) => <option key={e.id} value={e.id}>{e.apelido}</option>)}
              </select>
            </label>
          )}
          <label className="filtro">
            <span>Ano</span>
            <select value={ano} onChange={(e) => setAno(e.target.value)}>
              <option value="todos">Seleções…</option>
              {anos.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </label>
          <label className="filtro">
            <span>Mês</span>
            <select value={mes} onChange={(e) => setMes(e.target.value)}>
              <option value="todos">Todos</option>
              {MESES.map((nome, i) => (
                <option key={nome} value={String(i + 1).padStart(2, '0')}>{nome}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="topo__direita">
          <button
            type="button" className="botao-resumo"
            aria-pressed={resumo} onClick={() => setResumo(!resumo)}
          >
            Resumo
          </button>
          {!empresaFixa && <Link to="/" className="link-admin">Admin</Link>}
        </div>

      </header>

      <nav className="abas" aria-label="Seções do painel">
        {ABAS.map((nome) => (
          <button
            key={nome} type="button"
            className={`aba ${aba === nome && !resumo ? 'aba--ativa' : ''}`}
            aria-current={aba === nome && !resumo ? 'page' : undefined}
            onClick={() => { setAba(nome); setResumo(false); }}
          >
            {nome}
          </button>
        ))}
      </nav>
     </div>

      <main className="painel">
        {!integridade.fecha && (
          <div className="aviso aviso--alerta">
            <div>
              <strong>A base não fecha em partida dobrada</strong>
              {integridade.totalPartidas} partidas, diferença de {brl(integridade.somaSaldos)} em
              {' '}{integridade.documentosAbertos.length}{' '}
              {integridade.documentosAbertos.length === 1 ? 'documento' : 'documentos'}.
              Costuma ser contrapartida que não veio na extração — os números abaixo
              ficam incompletos até isso ser resolvido.
              {integridade.documentosAbertos.length > 0 && (
                <>{' '}Maiores:{' '}
                  {integridade.documentosAbertos.slice(0, 5)
                    .map((d) => `${d.documento} (${brl(d.diferenca)})`).join(', ')}.
                </>
              )}
            </div>
          </div>
        )}

        {resumo ? (
          <Resumo
            partidas={partidas} todos={todos} corte={corte} inicioPeriodo={inicioPeriodo}
            empresa={empresa}
          />
        ) : aba === 'Balancete Financeiro' ? (
          <BalanceteFinanceiro key={empresa.id} todos={todos} empresa={empresa} />
        ) : aba === 'Contas Pagas e a Pagar' ? (
          <ContasPagasEPagar partidas={partidas} todos={todos} corte={corte} empresa={empresa} />
        ) : (
          <Aportes partidas={partidas} empresa={empresa} />
        )}
      </main>
     </div>
  );
}
