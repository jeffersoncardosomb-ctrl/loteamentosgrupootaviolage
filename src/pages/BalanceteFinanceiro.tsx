import { useMemo, useState } from 'react';
import { montarBalancete, porAno, saldoAplicacoes, saldoBancario } from '../lib/balancete';
import { conciliar } from '../lib/conciliacao';
import { brl, titulosEmAbertoEm } from '../lib/contasPagar';
import { soma } from '../lib/dados';
import type { Partida } from '../lib/types';
import { GraficoBarras } from '../components/Graficos';

export function BalanceteFinanceiro({
  partidas, todos, corte,
}: {
  partidas: Partida[];
  todos: Partida[];
  corte: string;
}) {
  const serie = useMemo(() => porAno(todos), [todos]);

  /**
   * O balancete é posição (o quanto existe naquela data), não movimentação
   * do período — por isso usa `todos` até `corte`, e não `partidas` (que é
   * só o que se moveu no mês). Senão, um mês em que se pagou mais do que se
   * lançou de título novo, por exemplo, mostraria "Saldo Contas a Pagar"
   * negativo, e as linhas de Entradas/Despesas/Investimentos mostrariam só
   * o movimento do mês em vez do saldo acumulado da conta.
   *
   * Quando o período selecionado ainda não tem nenhum lançamento (`partidas`
   * vazio — ex.: mês futuro, ainda sem base importada), zera tudo em vez de
   * repetir a última posição conhecida, que ficaria parecendo atual.
   */
  const semDados = partidas.length === 0;
  const posicao = useMemo(
    () => (semDados ? [] : todos.filter((p) => p.data <= corte)),
    [todos, corte, semDados],
  );
  const blocos = useMemo(() => montarBalancete(posicao), [posicao]);
  const acumulado = useMemo(() => conciliar(todos), [todos]);
  const saldoPagar = useMemo(
    () => (semDados ? 0 : soma(titulosEmAbertoEm(acumulado.titulos, corte).map((t) => t.saldo))),
    [acumulado, corte, semDados],
  );
  const banco = useMemo(() => saldoBancario(posicao), [posicao]);
  const aplicacoes = useMemo(() => saldoAplicacoes(posicao), [posicao]);
  const [abertos, setAbertos] = useState<Set<string>>(new Set());

  const alternar = (chave: string) => {
    const novo = new Set(abertos);
    novo.has(chave) ? novo.delete(chave) : novo.add(chave);
    setAbertos(novo);
  };

  return (
    <div className="colunas colunas--balancete">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {blocos.map((bloco) => (
          <div className="grupo" key={bloco.titulo}>
            <div className="grupo__cabecalho">
              <span>{bloco.titulo}</span>
              <span>Valor (R$)</span>
            </div>
            {bloco.linhas.map((linha) => {
              const chave = `${bloco.titulo}|${linha.rotulo}`;
              const aberto = abertos.has(chave);
              return (
                <div key={chave}>
                  <div className="grupo__linha">
                    <span className="grupo__rotulo">
                      <button
                        type="button"
                        onClick={() => alternar(chave)}
                        aria-expanded={aberto}
                        aria-label={`${aberto ? 'Recolher' : 'Expandir'} ${linha.rotulo}`}
                      >
                        {aberto ? '−' : '+'}
                      </button>
                      {linha.rotulo}
                    </span>
                    <span className="grupo__valor">{brl(linha.valor)}</span>
                  </div>
                  {aberto && linha.detalhes.map((d) => (
                    <div className="grupo__detalhe" key={d.conta}>
                      <span>{d.conta} · {d.nome}</span>
                      <span>{brl(d.valor)}</span>
                    </div>
                  ))}
                  {aberto && linha.detalhes.length === 0 && (
                    <div className="grupo__detalhe"><span>Sem saldo na data selecionada</span><span>—</span></div>
                  )}
                </div>
              );
            })}
            <div className="grupo__total">
              <span>Total</span>
              <span>{brl(bloco.total)}</span>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="colunas colunas--3">
          <div className="kpi">
            <div className="kpi__valor">{brl(saldoPagar)}</div>
            <div className="kpi__rotulo">Saldo Contas a Pagar</div>
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

        <div className="cartao">
          <p className="cartao__titulo" style={{ textAlign: 'center' }}>
            Entradas e Saídas por Ano
          </p>
          <GraficoBarras categorias={serie.categorias} series={serie.series} altura={280} />
        </div>

        <div className="aviso">
          <div>
            <strong>Classificação editável</strong>
            As linhas acima são montadas por prefixo de conta em
            {' '}<code>src/lib/config.ts</code>. Ajuste ali para casar exatamente com as
            medidas do Power BI — o resto do painel acompanha sozinho.
          </div>
        </div>
      </div>
    </div>
  );
}
