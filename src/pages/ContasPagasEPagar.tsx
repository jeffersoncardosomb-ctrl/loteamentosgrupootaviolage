import { useMemo, useState } from 'react';
import { conciliar } from '../lib/conciliacao';
import { aging, brl, dataBR, titulosEmAbertoEm } from '../lib/contasPagar';
import type { Empresa } from '../lib/empresas';
import type { Partida } from '../lib/types';
import { Rosca } from '../components/Graficos';

export function ContasPagasEPagar({
  partidas, corte, todos, empresa,
}: {
  partidas: Partida[];
  corte: string;
  todos: Partida[];
  empresa: Empresa;
}) {
  const doPeriodo = useMemo(() => conciliar(partidas, empresa), [partidas, empresa]);
  const acumulado = useMemo(() => conciliar(todos, empresa), [todos, empresa]);
  const [detalhe, setDetalhe] = useState<string | null>(null);

  const pagas = doPeriodo.baixas.slice().sort((a, b) => a.data.localeCompare(b.data));
  const totalPago = pagas.reduce((a, b) => a + b.valor, 0);

  const emAberto = useMemo(
    () => titulosEmAbertoEm(acumulado.titulos, corte),
    [acumulado, corte],
  );
  const totalAberto = emAberto.reduce((a, t) => a + t.saldo, 0);
  const faixas = aging(emAberto).filter((f) => f.valor > 0);

  const semTitulo = doPeriodo.divergencias;

  return (
    <>
      <div className="colunas colunas--pagar">
        <div className="cartao cartao--limpo">
          <table className="tabela">
            <thead>
              <tr>
                <th>Data</th>
                <th>Doc.</th>
                <th>Contas Pagas</th>
                <th className="num">Valor (R$)</th>
              </tr>
            </thead>
            <tbody>
              {pagas.length === 0 && (
                <tr><td colSpan={4} className="vazio">Nenhum pagamento no período selecionado.</td></tr>
              )}
              {pagas.map((b, i) => (
                <tr key={b.id} className={i % 2 ? 'zebra' : ''}>
                  <td>{dataBR(b.data)}</td>
                  <td className="fraco">{b.documento || '—'}</td>
                  <td>{b.complemento || '(sem histórico)'}</td>
                  <td className="num">{brl(b.valor)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={3}>Total</td>
                <td className="num">{brl(totalPago)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="cartao cartao--limpo">
            <table className="tabela">
              <thead>
                <tr>
                  <th>Contas a Pagar</th>
                  <th className="num">Valor (R$)</th>
                </tr>
              </thead>
              <tbody>
                {emAberto.length === 0 && (
                  <tr><td colSpan={2} className="vazio">Nada em aberto em {dataBR(corte)}.</td></tr>
                )}
                {emAberto.map((t, i) => (
                  <tr
                    key={t.id}
                    className={`clicavel ${i % 2 ? 'zebra' : ''}`}
                    onClick={() => setDetalhe(detalhe === t.id ? null : t.id)}
                  >
                    <td>
                      {t.complemento || t.fornecedor}
                      <br />
                      <span className="fraco" style={{ fontSize: 11 }}>
                        {dataBR(t.data)} · {t.diasEmAberto} dias · {t.conta}
                      </span>
                    </td>
                    <td className="num">{brl(t.saldo)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td>Total</td>
                  <td className="num">{brl(totalAberto)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="cartao">
            <Rosca
              fatias={[
                { rotulo: 'Contas a Pagar', valor: totalAberto, cor: 'var(--laranja)' },
                { rotulo: 'Contas Pagas', valor: totalPago, cor: 'var(--verde)' },
              ]}
              altura={190}
            />
          </div>
        </div>
      </div>

      <div className="colunas colunas--2">
        <div className="cartao">
          <p className="cartao__titulo">Idade do que está em aberto</p>
          {faixas.length === 0 ? (
            <p className="vazio">Nada em aberto nesta data.</p>
          ) : (
            <table className="tabela">
              <tbody>
                {faixas.map((f, i) => (
                  <tr key={f.rotulo} className={i % 2 ? 'zebra' : ''}>
                    <td>{f.rotulo}</td>
                    <td className="num fraco">{f.quantidade} tít.</td>
                    <td className="num">{brl(f.valor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="cartao">
          <p className="cartao__titulo">Conciliação do período</p>
          <p className="cartao__legenda">
            {doPeriodo.resumo.baixasConciliadas} de {doPeriodo.resumo.qtdBaixas} pagamentos
            {' '}amarrados a um título pelo número do documento, pelo nome do credor ou pela conta
          </p>

          {semTitulo.length === 0 ? (
            <div className="aviso">
              <div>
                <strong>Tudo conferido</strong>
                Todo pagamento do período tem um título correspondente na mesma conta.
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {semTitulo.map((d) => (
                <div className="aviso aviso--alerta" key={d.id}>
                  <div>
                    <strong>Pagamento sem título na mesma conta — {brl(d.valor)}</strong>
                    {dataBR(d.data)} · {d.conta} · {d.descricao}. Débito em conta a pagar
                    sem crédito correspondente. Costuma ser título classificado em outra
                    conta do grupo 2.1.
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {detalhe && (
        <div className="cartao cartao--limpo">
          <div style={{ padding: '12px 16px 0' }}>
            <p className="cartao__titulo" style={{ margin: '0 0 10px' }}>
              Pagamentos aplicados a este título
            </p>
          </div>
          <table className="tabela">
            <thead>
              <tr>
                <th>Data</th>
                <th className="num">Valor (R$)</th>
                <th>Amarrado por</th>
              </tr>
            </thead>
            <tbody>
              {(emAberto.find((t) => t.id === detalhe)?.baixas ?? [])
                .filter((b) => b.data <= corte)
                .map((b, i) => (
                  <tr key={b.baixaId} className={i % 2 ? 'zebra' : ''}>
                    <td>{dataBR(b.data)}</td>
                    <td className="num">{brl(b.valor)}</td>
                    <td className="fraco">{b.regra}</td>
                  </tr>
                ))}
              {(emAberto.find((t) => t.id === detalhe)?.baixas ?? []).filter((b) => b.data <= corte).length === 0 && (
                <tr><td colSpan={3} className="vazio">Nenhum pagamento aplicado até {dataBR(corte)}.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
