import { useMemo } from 'react';
import { saldoAplicacoes, saldoBancario } from '../lib/balancete';
import { movimentoCaixa } from '../lib/caixa';
import { conciliar } from '../lib/conciliacao';
import { brl, titulosEmAbertoEm } from '../lib/contasPagar';
import { soma } from '../lib/dados';
import type { Empresa } from '../lib/empresas';
import { montarBlocosCaixa, porAnoCaixa, type BlocoCaixaCalculado } from '../lib/rastreioPagamentos';
import type { Partida } from '../lib/types';
import { GraficoBarras } from '../components/Graficos';

export function BalanceteFinanceiro({
  partidas, todos, corte, empresa,
}: {
  partidas: Partida[];
  todos: Partida[];
  corte: string;
  empresa: Empresa;
}) {
  const serie = useMemo(() => porAnoCaixa(todos, empresa), [todos, empresa]);

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

  /**
   * Composição em regime de caixa: "Entradas" é o dinheiro que efetivamente
   * entrou no banco/aplicações (mesma origem da Conciliação de Caixa do
   * Resumo). "Adiantamentos"/"Despesas"/"Investimentos" vêm do rastreamento
   * de pagamento até a categoria contábil original — não do que foi
   * reconhecido por competência, mas do que foi de fato pago, na data em
   * que o dinheiro saiu. Por isso a soma fecha com Saldo Bancário + Saldo
   * de Aplicações Bancárias, ao contrário do regime de competência.
   */
  const caixa = useMemo(() => movimentoCaixa(posicao, empresa), [posicao, empresa]);
  const rastreados = useMemo(
    () => montarBlocosCaixa(semDados ? [] : todos, empresa, corte),
    [todos, empresa, corte, semDados],
  );
  const despesasFinanceiras = caixa.saidas.find((l) => l.rotulo === 'Despesas Financeiras');
  const blocos: BlocoCaixaCalculado[] = useMemo(() => {
    const entradas: BlocoCaixaCalculado = {
      titulo: 'Entradas',
      linhas: caixa.entradas,
      total: caixa.totalEntradas,
    };
    const comDespesasFinanceiras = rastreados.map((bloco) => {
      if (bloco.titulo !== 'Despesas' || !despesasFinanceiras || despesasFinanceiras.valor === 0) {
        return bloco;
      }
      return {
        ...bloco,
        linhas: [...bloco.linhas, {
          rotulo: 'Despesas Financeiras',
          valor: despesasFinanceiras.valor,
          quantidade: despesasFinanceiras.quantidade,
        }],
        total: soma([bloco.total, despesasFinanceiras.valor]),
      };
    });
    return [entradas, ...comDespesasFinanceiras];
  }, [caixa, rastreados, despesasFinanceiras]);

  const acumulado = useMemo(() => conciliar(todos, empresa), [todos, empresa]);
  const saldoPagar = useMemo(
    () => (semDados ? 0 : soma(titulosEmAbertoEm(acumulado.titulos, corte).map((t) => t.saldo))),
    [acumulado, corte, semDados],
  );
  const banco = useMemo(() => saldoBancario(posicao, empresa), [posicao, empresa]);
  const aplicacoes = useMemo(() => saldoAplicacoes(posicao, empresa), [posicao, empresa]);

  return (
    <div className="colunas colunas--balancete">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {blocos.map((bloco) => (
          <div className="grupo" key={bloco.titulo}>
            <div className="grupo__cabecalho">
              <span>{bloco.titulo}</span>
              <span>Valor (R$)</span>
            </div>
            {bloco.linhas.map((linha) => (
              <div className="grupo__linha" key={linha.rotulo}>
                <span className="grupo__rotulo">
                  {linha.rotulo}{' '}
                  <span style={{ color: 'var(--texto-fraco)', fontWeight: 400 }}>· {linha.quantidade}</span>
                </span>
                <span className="grupo__valor">{brl(linha.valor)}</span>
              </div>
            ))}
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
            <strong>Regime de caixa</strong>
            Ao contrário das outras abas, aqui cada pagamento é rastreado até a
            categoria de origem (não o que foi lançado por competência, mas o que
            de fato saiu do caixa) — por isso a soma fecha com Saldo Bancário +
            Saldo de Aplicações Bancárias acima. As regras de classificação ficam
            em <code>src/lib/empresas.ts</code>, por empresa.
          </div>
        </div>
      </div>
    </div>
  );
}
