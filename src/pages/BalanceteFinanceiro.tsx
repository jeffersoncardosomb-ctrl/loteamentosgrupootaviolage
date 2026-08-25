import { useMemo, useState } from 'react';
import { saldoAplicacoes, saldoBancario } from '../lib/balancete';
import { movimentoCaixa } from '../lib/caixa';
import { conciliar } from '../lib/conciliacao';
import { brl, dataBR, fimDoMes, titulosEmAbertoEm } from '../lib/contasPagar';
import { soma } from '../lib/dados';
import type { Empresa } from '../lib/empresas';
import { montarBlocosCaixa, porAnoCaixa, OUTRAS_ENTRADAS, type BlocoCaixaCalculado } from '../lib/rastreioPagamentos';
import type { Partida } from '../lib/types';
import { GraficoBarras } from '../components/Graficos';

/** Mês mais recente com lançamento, no formato AAAA-MM — abre a aba já no último mês. */
function mesMaisRecente(todos: Partida[]): string {
  const ultima = todos.reduce((a, p) => (p.data > a ? p.data : a), '0000-00-00');
  return ultima === '0000-00-00' ? new Date().toISOString().slice(0, 7) : ultima.slice(0, 7);
}

export function BalanceteFinanceiro({ todos, empresa }: { todos: Partida[]; empresa: Empresa }) {
  const [mesInicio, setMesInicio] = useState(() => mesMaisRecente(todos));
  const [mesFim, setMesFim] = useState(() => mesMaisRecente(todos));

  // Corrige silenciosamente se o usuário inverter início/fim.
  const [inicioEfetivo, fimEfetivo] = mesInicio <= mesFim ? [mesInicio, mesFim] : [mesFim, mesInicio];
  const dataInicio = `${inicioEfetivo}-01`;
  const dataFimPeriodo = fimDoMes(fimEfetivo);

  const serie = useMemo(() => porAnoCaixa(todos, empresa), [todos, empresa]);

  /**
   * Ao contrário das outras abas (posição acumulada desde o início), aqui é
   * o movimento financeiro DENTRO do período selecionado — quanto entrou e
   * saiu de caixa naquele intervalo, não o saldo acumulado até ele. Um
   * período sem nenhum lançamento zera naturalmente (nada cai no filtro de
   * data) — "Saldo Anterior" continua aparecendo normalmente, porque é
   * posição (independe de o período em si ter movimento).
   */
  const partidasDoPeriodo = useMemo(
    () => todos.filter((p) => p.data >= dataInicio && p.data <= dataFimPeriodo),
    [todos, dataInicio, dataFimPeriodo],
  );

  const posicaoAntes = useMemo(() => todos.filter((p) => p.data < dataInicio), [todos, dataInicio]);
  const posicaoFim = useMemo(
    () => todos.filter((p) => p.data <= dataFimPeriodo),
    [todos, dataFimPeriodo],
  );

  const saldoAnterior = saldoBancario(posicaoAntes, empresa) + saldoAplicacoes(posicaoAntes, empresa);
  const banco = saldoBancario(posicaoFim, empresa);
  const aplicacoes = saldoAplicacoes(posicaoFim, empresa);

  const caixa = useMemo(() => movimentoCaixa(partidasDoPeriodo, empresa), [partidasDoPeriodo, empresa]);
  const rastreados = useMemo(
    () => montarBlocosCaixa(todos, empresa, dataFimPeriodo, dataInicio),
    [todos, empresa, dataFimPeriodo, dataInicio],
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

  const resultadoPeriodo = useMemo(
    () =>
      soma(
        blocos.map((b) =>
          b.titulo === 'Entradas' || b.titulo === OUTRAS_ENTRADAS ? b.total : -b.total,
        ),
      ),
    [blocos],
  );

  const acumulado = useMemo(() => conciliar(todos, empresa), [todos, empresa]);
  const saldoPagar = useMemo(
    () => soma(titulosEmAbertoEm(acumulado.titulos, dataFimPeriodo).map((t) => t.saldo)),
    [acumulado, dataFimPeriodo],
  );

  return (
    <div className="colunas colunas--balancete">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="cartao">
          <p className="cartao__titulo">Período</p>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <label className="filtro-periodo">
              <span>De</span>
              <input type="month" value={mesInicio} onChange={(e) => setMesInicio(e.target.value)} />
            </label>
            <label className="filtro-periodo">
              <span>Até</span>
              <input type="month" value={mesFim} onChange={(e) => setMesFim(e.target.value)} />
            </label>
          </div>
          <div className="grupo__total" style={{ marginTop: 12 }}>
            <span>Saldo Anterior · {dataBR(dataInicio)}</span>
            <span>{brl(saldoAnterior)}</span>
          </div>
        </div>

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

        <div className="cartao">
          <div className="grupo__total">
            <span>Resultado do Período</span>
            <span>{brl(resultadoPeriodo)}</span>
          </div>
          <div className="grupo__total" style={{ marginTop: 6 }}>
            <span>Saldo Bancário + Aplicações · {dataBR(dataFimPeriodo)}</span>
            <span>{brl(banco + aplicacoes)}</span>
          </div>
          <p className="cartao__legenda" style={{ margin: '6px 0 0' }}>
            Saldo Anterior + Resultado do Período = Saldo Bancário + Saldo de Aplicações
            Bancárias no fim do período.
          </p>
        </div>
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
            Os blocos acima mostram o movimento financeiro do período selecionado —
            cada pagamento é rastreado até a categoria de origem (não o que foi
            lançado por competência, mas o que de fato saiu do caixa naquele
            intervalo). Os KPIs de saldo à direita são a posição no fim do período,
            usada para a comparação acima. "Não Classificado" é um ajuste de
            reconciliação — a diferença entre o que realmente saiu do caixa e o que
            foi possível categorizar; pode aparecer negativo, quando o rastreamento
            atribuiu a uma categoria mais do que de fato saiu (lançamentos incomuns,
            com mais de duas pernas). Garante que a soma sempre feche com o Saldo
            Bancário + Aplicações. As regras de classificação ficam em
            {' '}<code>src/lib/empresas.ts</code>, por empresa.
          </div>
        </div>
      </div>
    </div>
  );
}
