import { useMemo, useState } from 'react';
import lancamentos from '../data/lancamentos.json';
import { conciliar } from '../lib/conciliacao';
import {
  aging, brl, brlCurto, dataBR, fimDoMes, porConta, porFornecedor,
  serieMensal, titulosEmAbertoEm,
} from '../lib/contasPagar';
import type { Lancamento, TituloEmAberto } from '../lib/types';
import { ReguaMeses } from '../components/ReguaMeses';

export default function ContasPagar() {
  const resultado = useMemo(() => conciliar(lancamentos as Lancamento[]), []);
  const serie = useMemo(() => serieMensal(resultado), [resultado]);
  const [mes, setMes] = useState(() => serie[serie.length - 1]?.mes ?? '');
  const [expandido, setExpandido] = useState<string | null>(null);

  const corte = fimDoMes(mes);
  const abertos = useMemo(
    () => titulosEmAbertoEm(resultado.titulos, corte),
    [resultado, corte],
  );
  const posicao = serie.find((m) => m.mes === mes);
  const faixas = aging(abertos);
  const fornecedores = porFornecedor(abertos).slice(0, 6);
  const contas = porConta(abertos);
  const totalAberto = abertos.reduce((a, t) => a + t.saldo, 0);
  const divergenciasAteCorte = resultado.divergencias.filter((d) => d.data <= corte);

  return (
    <div className="pagina">
      <header className="cabecalho">
        <div>
          <p className="cabecalho__eyebrow">Loteamento Serra Bonita</p>
          <h1 className="cabecalho__titulo">Contas a pagar</h1>
        </div>
        <label className="seletor">
          <span>Posição em</span>
          <select value={mes} onChange={(e) => setMes(e.target.value)}>
            {[...serie].reverse().map((m) => (
              <option key={m.mes} value={m.mes}>
                {dataBR(fimDoMes(m.mes))}
              </option>
            ))}
          </select>
        </label>
      </header>

      <ReguaMeses serie={serie} mesAtivo={mes} onSelecionar={setMes} />

      <section className="grade">
        <aside className="coluna-lateral">
          <div className="cartao cartao--destaque">
            <p className="rotulo">Em aberto em {dataBR(corte)}</p>
            <p className="numero-grande">{brl(totalAberto)}</p>
            <p className="rotulo-secundario">
              {abertos.length} {abertos.length === 1 ? 'título' : 'títulos'} ·
              {' '}{contas.length} {contas.length === 1 ? 'conta' : 'contas'}
            </p>
          </div>

          <div className="cartao">
            <p className="rotulo">Movimento do mês</p>
            <dl className="lista-dados">
              <div>
                <dt>Títulos gerados</dt>
                <dd>{brl(posicao?.titulosValor ?? 0)}</dd>
              </div>
              <div>
                <dt>Pagamentos</dt>
                <dd>{brl(posicao?.baixasValor ?? 0)}</dd>
              </div>
              <div className="lista-dados__total">
                <dt>Variação</dt>
                <dd>
                  {brl((posicao?.titulosValor ?? 0) - (posicao?.baixasValor ?? 0))}
                </dd>
              </div>
            </dl>
          </div>

          <div className="cartao">
            <p className="rotulo">Idade dos títulos</p>
            <ul className="aging">
              {faixas.map((f) => {
                const pct = totalAberto > 0 ? (f.valor / totalAberto) * 100 : 0;
                return (
                  <li key={f.rotulo} className={f.valor === 0 ? 'aging--vazia' : ''}>
                    <div className="aging__topo">
                      <span>{f.rotulo}</span>
                      <span className="mono">{brl(f.valor)}</span>
                    </div>
                    <div className="aging__barra">
                      <span style={{ width: `${pct}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>

          {fornecedores.length > 0 && (
            <div className="cartao">
              <p className="rotulo">Maiores credores</p>
              <ul className="credores">
                {fornecedores.map((f) => (
                  <li key={f.nome}>
                    <span className="credores__nome">{f.nome}</span>
                    <span className="mono">{brlCurto(f.valor)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>

        <main className="coluna-principal">
          <div className="cartao cartao--tabela">
            <div className="cartao__cabecalho">
              <p className="rotulo">Títulos em aberto</p>
              <p className="rotulo-secundario">clique para ver as baixas aplicadas</p>
            </div>

            {abertos.length === 0 ? (
              <p className="vazio">
                Nenhum título em aberto nesta data. Todos os títulos gerados até
                {' '}{dataBR(corte)} foram quitados.
              </p>
            ) : (
              <table className="tabela">
                <thead>
                  <tr>
                    <th>Emissão</th>
                    <th>Documento</th>
                    <th>Credor</th>
                    <th>Conta</th>
                    <th className="direita">Valor</th>
                    <th className="direita">Pago</th>
                    <th className="direita">Em aberto</th>
                    <th className="direita">Dias</th>
                  </tr>
                </thead>
                <tbody>
                  {abertos.map((t) => (
                    <LinhaTitulo
                      key={t.id}
                      titulo={t}
                      aberta={expandido === t.id}
                      onAlternar={() => setExpandido(expandido === t.id ? null : t.id)}
                      corte={corte}
                    />
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={6}>Total</td>
                    <td className="direita mono forte">{brl(totalAberto)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            )}
          </div>

          <div className="cartao">
            <div className="cartao__cabecalho">
              <p className="rotulo">Conciliação</p>
              <p className="rotulo-secundario">
                {resultado.resumo.baixasConciliadas} de {resultado.resumo.qtdBaixas} baixas amarradas a um título
              </p>
            </div>

            <div className="prova">
              <div>
                <dt>Títulos gerados no período</dt>
                <dd className="mono">{brl(resultado.resumo.valorTitulos)}</dd>
              </div>
              <div>
                <dt>Pagamentos no período</dt>
                <dd className="mono">−{brl(resultado.resumo.valorBaixas)}</dd>
              </div>
              <div className="prova__total">
                <dt>Saldo contábil do grupo 2.1</dt>
                <dd className="mono">{brl(resultado.resumo.saldoContabil)}</dd>
              </div>
            </div>

            {divergenciasAteCorte.length > 0 && (
              <div className="divergencias">
                <p className="rotulo rotulo--alerta">
                  Pagamentos sem título correspondente
                </p>
                <p className="rotulo-secundario">
                  Débito em conta a pagar sem crédito na mesma conta. Costuma ser
                  título lançado em outra conta do grupo — vale conferir a
                  classificação antes de fechar o mês.
                </p>
                <ul className="divergencias__lista">
                  {divergenciasAteCorte.map((d) => (
                    <li key={d.id}>
                      <span className="mono">{dataBR(d.data)}</span>
                      <span className="mono">{d.conta}</span>
                      <span>{d.descricao}</span>
                      <span className="mono forte">{brl(d.valor)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </main>
      </section>
    </div>
  );
}

function LinhaTitulo({
  titulo, aberta, onAlternar, corte,
}: {
  titulo: TituloEmAberto;
  aberta: boolean;
  onAlternar: () => void;
  corte: string;
}) {
  const baixasAteCorte = titulo.baixas.filter((b) => b.data <= corte);
  return (
    <>
      <tr
        className={`tabela__linha ${aberta ? 'tabela__linha--aberta' : ''}`}
        onClick={onAlternar}
      >
        <td className="mono">{dataBR(titulo.data)}</td>
        <td className="mono">{titulo.documento || '—'}</td>
        <td className="credor">{titulo.fornecedor || titulo.complemento}</td>
        <td className="mono discreto">{titulo.conta}</td>
        <td className="direita mono">{brl(titulo.valor)}</td>
        <td className="direita mono discreto">
          {titulo.pago > 0 ? brl(titulo.pago) : '—'}
        </td>
        <td className="direita mono forte">{brl(titulo.saldo)}</td>
        <td className="direita mono">{titulo.diasEmAberto}</td>
      </tr>
      {aberta && (
        <tr className="detalhe">
          <td colSpan={8}>
            <p className="detalhe__complemento">{titulo.complemento}</p>
            {titulo.centroCusto && (
              <p className="detalhe__cc">Centro de custo: {titulo.centroCusto}</p>
            )}
            {baixasAteCorte.length === 0 ? (
              <p className="detalhe__vazio">Nenhum pagamento aplicado até {dataBR(corte)}.</p>
            ) : (
              <ul className="detalhe__baixas">
                {baixasAteCorte.map((b) => (
                  <li key={b.baixaId}>
                    <span className="mono">{dataBR(b.data)}</span>
                    <span className="mono">{brl(b.valor)}</span>
                    <span className="etiqueta">amarrado por {b.regra}</span>
                  </li>
                ))}
              </ul>
            )}
          </td>
        </tr>
      )}
    </>
  );
}
