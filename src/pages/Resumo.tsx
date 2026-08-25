import { useMemo } from 'react';
import { montarBalancete, saldoAplicacoes, saldoBancario } from '../lib/balancete';
import { conciliar } from '../lib/conciliacao';
import { montarQuadroAportes } from '../lib/aportes';
import { movimentoCaixa } from '../lib/caixa';
import { brl, dataBR, titulosEmAbertoEm } from '../lib/contasPagar';
import { soma } from '../lib/dados';
import type { Empresa } from '../lib/empresas';
import type { Partida } from '../lib/types';
import { GraficoBarras } from '../components/Graficos';

export function Resumo({
  partidas, todos, corte, inicioPeriodo, empresa,
}: {
  partidas: Partida[];
  todos: Partida[];
  corte: string;
  inicioPeriodo: string | null;
  empresa: Empresa;
}) {
  const blocos = useMemo(() => montarBalancete(partidas, empresa), [partidas, empresa]);
  const acumulado = useMemo(() => conciliar(todos, empresa), [todos, empresa]);
  const aportes = useMemo(() => montarQuadroAportes(todos, empresa), [todos, empresa]);
  const emAberto = useMemo(() => titulosEmAbertoEm(acumulado.titulos, corte), [acumulado, corte]);

  const posicao = useMemo(() => todos.filter((p) => p.data <= corte), [todos, corte]);
  const banco = saldoBancario(posicao, empresa);
  const aplicacoes = saldoAplicacoes(posicao, empresa);

  /**
   * Conciliação de caixa: ao contrário de Entradas/Despesas/Investimentos
   * (regime de competência, podem incluir contas a receber e provisões que
   * ainda não viraram caixa), aqui a origem é só o próprio livro banco +
   * aplicações — por isso fecha exatamente com a posição de caixa.
   */
  const posicaoAntes = useMemo(
    () => (inicioPeriodo ? todos.filter((p) => p.data < inicioPeriodo) : []),
    [todos, inicioPeriodo],
  );
  const saldoInicial = inicioPeriodo
    ? saldoBancario(posicaoAntes, empresa) + saldoAplicacoes(posicaoAntes, empresa)
    : 0;
  const caixa = useMemo(() => movimentoCaixa(partidas, empresa), [partidas, empresa]);
  const saldoFinalCaixa = soma([saldoInicial, caixa.totalEntradas, -caixa.totalSaidas]);

  const valor = (t: string) => blocos.find((b) => b.titulo === t)?.total ?? 0;
  const entradas = valor('Entradas');
  const despesas = valor('Despesas');
  const investimentos = valor('Investimentos');
  const totalAberto = soma(emAberto.map((t) => t.saldo));

  return (
    <>
      <div className="cartao">
        <p className="cartao__titulo" style={{ fontSize: 15 }}>{empresa.nome}</p>
        <p className="cartao__legenda">Posição em {dataBR(corte)}</p>
      </div>

      <div className="colunas colunas--3">
        <div className="kpi">
          <div className="kpi__valor kpi__valor--verde">{brl(entradas)}</div>
          <div className="kpi__rotulo">Entradas</div>
        </div>
        <div className="kpi">
          <div className="kpi__valor">{brl(despesas)}</div>
          <div className="kpi__rotulo">Despesas</div>
        </div>
        <div className="kpi">
          <div className="kpi__valor">{brl(investimentos)}</div>
          <div className="kpi__rotulo">Investimentos</div>
        </div>
      </div>

      <div className="colunas colunas--3">
        <div className="kpi">
          <div className="kpi__valor">{brl(totalAberto)}</div>
          <div className="kpi__rotulo">
            Contas a pagar em aberto · {emAberto.length}{' '}
            {emAberto.length === 1 ? 'título' : 'títulos'}
          </div>
        </div>
        <div className="kpi">
          <div className="kpi__valor">{brl(banco)}</div>
          <div className="kpi__rotulo">Saldo Bancário</div>
        </div>
        <div className="kpi">
          <div className="kpi__valor">{brl(aplicacoes)}</div>
          <div className="kpi__rotulo">Saldo de Aplicações Bancárias</div>
        </div>
      </div>

      <div className="kpi">
        <div className="kpi__valor kpi__valor--verde">
          {brl(aportes.totais.totalInvestido)}
        </div>
        <div className="kpi__rotulo">
          Capital dos sócios · {brl(aportes.totais.aportes)} em aportes e{' '}
          {brl(aportes.totais.afac)} em AFAC
        </div>
      </div>

      <div className="cartao">
        <p className="cartao__titulo">Conciliação de Caixa</p>
        <p className="cartao__legenda">
          {inicioPeriodo ? `${dataBR(inicioPeriodo)} a ${dataBR(corte)}` : `Desde o início até ${dataBR(corte)}`}
          {' '}· Banco + Aplicações Financeiras
        </p>

        <div className="grupo__total" style={{ marginBottom: 12 }}>
          <span>Saldo Caixa Inicial</span>
          <span>{brl(saldoInicial)}</span>
        </div>

        <div className="colunas colunas--2">
          <div className="grupo">
            <div className="grupo__cabecalho">
              <span>Entradas</span>
              <span>Valor (R$)</span>
            </div>
            {caixa.entradas.map((l) => (
              <div className="grupo__linha" key={l.rotulo}>
                <span className="grupo__rotulo">
                  {l.rotulo} <span style={{ color: 'var(--texto-fraco)', fontWeight: 400 }}>· {l.quantidade}</span>
                </span>
                <span className="grupo__valor">{brl(l.valor)}</span>
              </div>
            ))}
            <div className="grupo__total">
              <span>Total</span>
              <span>{brl(caixa.totalEntradas)}</span>
            </div>
          </div>

          <div className="grupo">
            <div className="grupo__cabecalho">
              <span>Saídas</span>
              <span>Valor (R$)</span>
            </div>
            {caixa.saidas.map((l) => (
              <div className="grupo__linha" key={l.rotulo}>
                <span className="grupo__rotulo">
                  {l.rotulo} <span style={{ color: 'var(--texto-fraco)', fontWeight: 400 }}>· {l.quantidade}</span>
                </span>
                <span className="grupo__valor">{brl(l.valor)}</span>
              </div>
            ))}
            <div className="grupo__total">
              <span>Total</span>
              <span>{brl(caixa.totalSaidas)}</span>
            </div>
          </div>
        </div>

        <div className="grupo__total" style={{ marginTop: 12 }}>
          <span>Saldo Caixa Final</span>
          <span>{brl(saldoFinalCaixa)}</span>
        </div>
        <p className="cartao__legenda" style={{ margin: '6px 0 0' }}>
          Saldo Caixa Inicial + Entradas − Saídas = Saldo Bancário + Saldo de Aplicações Bancárias
          {' '}acima.
        </p>
      </div>

      <div className="colunas colunas--2">
        <div className="cartao">
          <p className="cartao__titulo">Entrada de recursos dos sócios por ano</p>
          <GraficoBarras
            categorias={aportes.porAno.map((a) => String(a.ano))}
            series={[
              { rotulo: 'Aportes', cor: 'var(--laranja)', valores: aportes.porAno.map((a) => a.aportes) },
              { rotulo: 'AFAC', cor: 'var(--verde)', valores: aportes.porAno.map((a) => a.afac) },
            ]}
          />
        </div>
        <div className="cartao cartao--limpo">
          <div style={{ padding: '14px 16px 6px' }}>
            <p className="cartao__titulo" style={{ margin: 0 }}>Capital por sócio</p>
          </div>
          <table className="tabela">
            <thead>
              <tr>
                <th>Sócio</th>
                <th className="num">Aportes</th>
                <th className="num">AFAC</th>
                <th className="num">Total</th>
              </tr>
            </thead>
            <tbody>
              {aportes.socios.map((s, i) => (
                <tr key={s.nome} className={i % 2 ? 'zebra' : ''}>
                  <td>{s.nome}</td>
                  <td className="num">{brl(s.aportes)}</td>
                  <td className="num">{brl(s.afac)}</td>
                  <td className="num">{brl(s.totalInvestido)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td>Total</td>
                <td className="num">{brl(aportes.totais.aportes)}</td>
                <td className="num">{brl(aportes.totais.afac)}</td>
                <td className="num">{brl(aportes.totais.totalInvestido)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {aportes.totais.capitalSocial !== aportes.totais.aportes && (
        <div className="aviso">
          <div>
            <strong>Capital integralizado x contratado</strong>
            Contrato: {brl(aportes.totais.capitalSocial)} · razão: {brl(aportes.totais.aportes)} ·
            diferença de {brl(Math.abs(aportes.totais.aportes - aportes.totais.capitalSocial))}.
          </div>
        </div>
      )}
    </>
  );
}
