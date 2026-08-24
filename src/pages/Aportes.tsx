import { useMemo, useState } from 'react';
import { montarQuadroAportes } from '../lib/aportes';
import { brl, brlCurto, dataBR } from '../lib/contasPagar';
import type { Empresa } from '../lib/empresas';
import type { Partida } from '../lib/types';
import { GraficoBarras, Medidor } from '../components/Graficos';

const pct = (v: number) =>
  `${(v * 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;

export function Aportes({ partidas, empresa }: { partidas: Partida[]; empresa: Empresa }) {
  const q = useMemo(() => montarQuadroAportes(partidas, empresa), [partidas, empresa]);
  const [socioAberto, setSocioAberto] = useState<string | null>(null);

  const temNaoIdentificado =
    Math.abs(q.naoIdentificado.aportes) > 0.005 || Math.abs(q.naoIdentificado.afac) > 0.005;
  const diferencaCapital = q.totais.aportes - q.totais.capitalSocial;

  const movimentosDoSocio = socioAberto
    ? q.movimentos.filter((m) => m.socio === socioAberto)
    : [];

  return (
    <>
      <div className="cartao cartao--limpo">
        <table className="tabela">
          <thead>
            <tr>
              <th>Sócio</th>
              <th className="num">Capital Social (R$)</th>
              <th className="num">Aportes (R$)</th>
              <th className="num">%</th>
              <th className="num">Capital a Integralizar (R$)</th>
              <th className="num">AFAC (R$)</th>
              <th className="num">Total investido (R$)</th>
            </tr>
          </thead>
          <tbody>
            {q.socios.map((s, i) => (
              <tr
                key={s.nome}
                className={`clicavel ${i % 2 ? 'zebra' : ''}`}
                onClick={() => setSocioAberto(socioAberto === s.nome ? null : s.nome)}
              >
                <td>{s.nome}</td>
                <td className="num">{brl(s.capitalSocial)}</td>
                <td className="num">{brl(s.aportes)}</td>
                <td className="num">{pct(s.participacao)}</td>
                <td className={`num ${s.aIntegralizar < -0.005 ? 'positivo' : ''}`}>
                  {s.aIntegralizar < -0.005
                    ? `${brl(Math.abs(s.aIntegralizar))} a maior`
                    : brl(s.aIntegralizar)}
                </td>
                <td className="num">{brl(s.afac)}</td>
                <td className="num">{brl(s.totalInvestido)}</td>
              </tr>
            ))}
            {temNaoIdentificado && (
              <tr className="zebra">
                <td className="fraco">A identificar</td>
                <td className="num fraco">—</td>
                <td className="num negativo">{brl(q.naoIdentificado.aportes)}</td>
                <td className="num fraco">—</td>
                <td className="num fraco">—</td>
                <td className="num negativo">{brl(q.naoIdentificado.afac)}</td>
                <td className="num negativo">
                  {brl(q.naoIdentificado.aportes + q.naoIdentificado.afac)}
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr>
              <td>Total</td>
              <td className="num">{brl(q.totais.capitalSocial)}</td>
              <td className="num">{brl(q.totais.aportes)}</td>
              <td className="num">100,00%</td>
              <td className="num">{brl(q.totais.aIntegralizar)}</td>
              <td className="num">{brl(q.totais.afac)}</td>
              <td className="num">{brl(q.totais.totalInvestido)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {(Math.abs(diferencaCapital) > 0.005 || temNaoIdentificado) && (
        <div className="aviso">
          <div>
            {Math.abs(diferencaCapital) > 0.005 && (
              <p style={{ margin: '0 0 6px' }}>
                <strong>Aportes acima do capital contratado</strong>
                O razão registra {brl(q.totais.aportes)} em aportes, contra
                {' '}{brl(q.totais.capitalSocial)} de capital social — diferença de
                {' '}<strong>{brl(Math.abs(diferencaCapital))}</strong>. Vale conferir se
                é integralização a maior a devolver, se cabe alteração contratual ou se
                parte deveria estar em AFAC.
              </p>
            )}
            {temNaoIdentificado && (
              <div style={{ margin: 0 }}>
                <strong>Lançamentos sem sócio no complemento</strong>
                {brl(q.naoIdentificado.aportes + q.naoIdentificado.afac)} em
                {' '}{q.naoIdentificado.partidas.length}{' '}
                {q.naoIdentificado.partidas.length === 1 ? 'lançamento' : 'lançamentos'}
                {' '}ficaram fora do rateio. Corrija o complemento na escrituração ou,
                se o mês já estiver fechado, cadastre o id em
                {' '}<code>socioManual</code> ({'src/lib/empresas.ts'}):
                <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                  {q.naoIdentificado.partidas.map((l) => (
                    <li key={l.id}>
                      <code>'{l.id}': 'Nome do sócio',</code> — {dataBR(l.data)} ·{' '}
                      {l.complemento || '(sem histórico)'}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {q.avisosMapa.length > 0 && (
        <div className="aviso aviso--alerta">
          <div>
            <strong>Verifique a configuração de sócios</strong>
            Estas entradas foram ignoradas e os valores continuam em "a identificar":
            <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
              {q.avisosMapa.map((a) => <li key={a}>{a}</li>)}
            </ul>
          </div>
        </div>
      )}

      {socioAberto && (
        <div className="cartao cartao--limpo">
          <div style={{ padding: '12px 16px 0' }}>
            <p className="cartao__titulo" style={{ margin: 0 }}>
              Movimentos de {socioAberto}
            </p>
            <p className="cartao__legenda" style={{ margin: '4px 0 10px' }}>
              {movimentosDoSocio.length} lançamentos · clique de novo na linha da tabela para fechar
            </p>
          </div>
          <div style={{ maxHeight: 320, overflowY: 'auto' }}>
            <table className="tabela">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Tipo</th>
                  <th>Doc.</th>
                  <th>Histórico</th>
                  <th className="num">Valor (R$)</th>
                </tr>
              </thead>
              <tbody>
                {movimentosDoSocio.map((m, i) => (
                  <tr key={m.id} className={i % 2 ? 'zebra' : ''}>
                    <td>{dataBR(m.data)}</td>
                    <td>{m.tipo}</td>
                    <td className="fraco">{m.documento || '—'}</td>
                    <td>{m.complemento}</td>
                    <td className={`num ${m.valor < 0 ? 'negativo' : ''}`}>{brl(m.valor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="colunas colunas--2">
        <div className="cartao">
          <p className="cartao__titulo">Aportes e Capital a Integralizar por Sócio</p>
          <GraficoBarras
            categorias={q.socios.map((s) => s.nome.split(' ').slice(0, 2).join(' '))}
            series={[
              { rotulo: 'Aportes (R$)', cor: 'var(--laranja)', valores: q.socios.map((s) => s.aportes) },
              {
                rotulo: 'Capital a Integralizar (R$)', cor: '#2f4b8f',
                valores: q.socios.map((s) => Math.max(0, s.aIntegralizar)),
              },
            ]}
            altura={260}
            rotuloValor
          />
        </div>

        <div className="cartao">
          <p className="cartao__titulo">AFAC (R$) por Sócio</p>
          <GraficoBarras
            categorias={q.socios.map((s) => s.nome.split(' ').slice(0, 2).join(' '))}
            series={[{ rotulo: 'AFAC (R$)', cor: 'var(--verde)', valores: q.socios.map((s) => s.afac) }]}
            altura={260}
            rotuloValor
          />
        </div>
      </div>

      <div className="colunas colunas--2">
        <div className="cartao">
          <Medidor
            valor={q.totais.aportes} maximo={q.totais.capitalSocial}
            rotulo="Aportes (R$)" cor="var(--laranja)"
          />
        </div>
        <div className="cartao">
          <Medidor
            valor={q.totais.afac} maximo={1_000_000}
            rotulo="AFAC (R$)" cor="var(--verde)"
          />
        </div>
      </div>

      <div className="colunas colunas--2">
        <div className="cartao">
          <p className="cartao__titulo">Entrada de recursos por ano</p>
          <p className="cartao__legenda">
            Quando cada sócio efetivamente pôs dinheiro na sociedade
          </p>
          <GraficoBarras
            categorias={q.porAno.map((a) => String(a.ano))}
            series={[
              { rotulo: 'Aportes', cor: 'var(--laranja)', valores: q.porAno.map((a) => a.aportes) },
              { rotulo: 'AFAC', cor: 'var(--verde)', valores: q.porAno.map((a) => a.afac) },
            ]}
          />
        </div>

        <div className="cartao cartao--limpo">
          <div style={{ padding: '14px 16px 8px' }}>
            <p className="cartao__titulo" style={{ margin: 0 }}>
              Participação contratada x realizada
            </p>
            <p className="cartao__legenda" style={{ margin: '4px 0 0' }}>
              O quanto cada sócio deveria ter aportado e o quanto de fato aportou
            </p>
          </div>
          <table className="tabela">
            <thead>
              <tr>
                <th>Sócio</th>
                <th className="num">Contratada</th>
                <th className="num">Realizada</th>
                <th className="num">Diferença</th>
              </tr>
            </thead>
            <tbody>
              {q.socios.map((s, i) => {
                const dif = s.participacaoRealizada - s.participacao;
                return (
                  <tr key={s.nome} className={i % 2 ? 'zebra' : ''}>
                    <td>{s.nome}</td>
                    <td className="num">{pct(s.participacao)}</td>
                    <td className="num">{pct(s.participacaoRealizada)}</td>
                    <td className={`num ${Math.abs(dif) > 0.0005 ? 'negativo' : 'fraco'}`}>
                      {dif >= 0 ? '+' : '−'}{pct(Math.abs(dif))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
