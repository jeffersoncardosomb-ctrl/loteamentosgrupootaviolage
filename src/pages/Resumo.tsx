import { useMemo } from 'react';
import { montarBalancete, saldoBancario } from '../lib/balancete';
import { conciliar } from '../lib/conciliacao';
import { montarQuadroAportes } from '../lib/aportes';
import { brl, dataBR, titulosEmAbertoEm } from '../lib/contasPagar';
import type { Empresa } from '../lib/empresas';
import type { Partida } from '../lib/types';
import { GraficoBarras } from '../components/Graficos';

export function Resumo({
  partidas, todos, corte, empresa,
}: {
  partidas: Partida[];
  todos: Partida[];
  corte: string;
  empresa: Empresa;
}) {
  const blocos = useMemo(() => montarBalancete(partidas, empresa), [partidas, empresa]);
  const acumulado = useMemo(() => conciliar(todos, empresa), [todos, empresa]);
  const aportes = useMemo(() => montarQuadroAportes(todos, empresa), [todos, empresa]);
  const emAberto = useMemo(() => titulosEmAbertoEm(acumulado.titulos, corte), [acumulado, corte]);

  const valor = (t: string) => blocos.find((b) => b.titulo === t)?.total ?? 0;
  const entradas = valor('Entradas');
  const despesas = valor('Despesas');
  const investimentos = valor('Investimentos');
  const banco = saldoBancario(partidas, empresa);
  const totalAberto = emAberto.reduce((a, t) => a + t.saldo, 0);

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
          <div className="kpi__rotulo">Saldo bancário</div>
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
