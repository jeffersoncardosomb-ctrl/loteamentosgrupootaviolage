import { useMemo, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { EMPRESA } from './lib/config';
import { fimDoMes } from './lib/contasPagar';
import { conferirIntegridade, prepararPartidas } from './lib/dados';
import type { Partida } from './lib/types';
import { BalanceteFinanceiro } from './pages/BalanceteFinanceiro';
import { ContasPagasEPagar } from './pages/ContasPagasEPagar';
import { Aportes } from './pages/Aportes';
import { Resumo } from './pages/Resumo';
import { brl } from './lib/contasPagar';

const ABAS = ['Balancete Financeiro', 'Contas Pagas e a Pagar', 'Aportes'] as const;
type Aba = (typeof ABAS)[number];

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

export default function App({ base }: { base: Partida[] }) {
  const todos = useMemo(() => prepararPartidas(base), [base]);
  const integridade = useMemo(() => conferirIntegridade(todos), [todos]);

  const [aba, setAba] = useState<Aba>('Contas Pagas e a Pagar');
  const [ano, setAno] = useState('todos');
  const [mes, setMes] = useState('todos');
  const [resumo, setResumo] = useState(false);

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

  return (
    <div className="app">
      <header className="topo">
        <div className="marca">
          <div className="marca__nome">LAGE</div>
          <div className="marca__sub">Grupo Negócio Lage</div>
        </div>

        <div className="filtros">
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
          <Resumo partidas={partidas} todos={todos} corte={corte} empresa={EMPRESA.nome} />
        ) : aba === 'Balancete Financeiro' ? (
          <BalanceteFinanceiro partidas={partidas} todos={todos} />
        ) : aba === 'Contas Pagas e a Pagar' ? (
          <ContasPagasEPagar partidas={partidas} todos={todos} corte={corte} />
        ) : (
          <Aportes partidas={partidas} />
        )}
      </main>
    </div>
  );
}
