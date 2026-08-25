import { SERIES_ANO, type BlocoBalancete, type Empresa } from './empresas';
import { filtrarLinha } from './balancete';
import { ehDespesaFinanceira, movimentoCaixa } from './caixa';
import { conciliar } from './conciliacao';
import { arredonda, soma } from './dados';
import type { Partida } from './types';

export const NAO_CLASSIFICADO = 'Não Classificado';

export interface MovimentoRastreado {
  /** rótulo da linha de origem (ex.: "Despesas administrativas e Gerais"), ou NAO_CLASSIFICADO */
  categoria: string;
  /** data em que o dinheiro efetivamente saiu/entrou do caixa */
  data: string;
  valor: number;
}

export interface LinhaCaixaCalculada {
  rotulo: string;
  valor: number;
  quantidade: number;
}

export interface BlocoCaixaCalculado {
  titulo: string;
  linhas: LinhaCaixaCalculada[];
  total: number;
}

const chaveDoc = (documento: string, data: string) => `${documento}|${data}`;

const casaAlguma = (conta: string, prefixos: string[]) => prefixos.some((c) => conta.startsWith(c));

/**
 * Rastreia, para as linhas de Despesas/Investimentos/Adiantamentos, quando o
 * dinheiro correspondente efetivamente saiu do caixa — em vez de quando a
 * despesa foi reconhecida contabilmente (regime de competência).
 *
 * Cada lançamento contábil tem duas pernas com o mesmo documento e a mesma
 * data (é a prova da partida dobrada). Para achar a perna "caixa" de um
 * lançamento de despesa:
 *
 *   1. Se existe uma perna em contas a pagar (2.1.*) no mesmo documento+data,
 *      esse é o título — usa o motor de conciliação já existente
 *      (`conciliar`) para achar as baixas (podem cair em datas bem
 *      posteriores, parcelado). Cada baixa vira um movimento rastreado, na
 *      data em que foi paga.
 *   2. Senão, se existe uma perna direto no banco/aplicações no mesmo
 *      documento+data, é um pagamento direto (sem passar por título) — o
 *      próprio lançamento já é a data/valor do caixa.
 *   3. Se nenhuma das duas achar, o lançamento fica de fora (não dá pra
 *      saber quando foi pago) — quem chama soma o resíduo como "não
 *      classificado", pra não sumir dinheiro silenciosamente.
 */
export function rastrearPagamentos(todos: Partida[], empresa: Empresa): MovimentoRastreado[] {
  const ehContasPagar = (conta: string) =>
    casaAlguma(conta, empresa.contasPagar) &&
    !casaAlguma(conta, empresa.contasPagarExceto ?? []);
  const ehCaixa = (conta: string) =>
    casaAlguma(conta, empresa.contasBanco) || casaAlguma(conta, empresa.contasAplicacoes ?? []);

  const porChave = new Map<string, Partida[]>();
  for (const p of todos) {
    if (!p.documento) continue;
    const chave = chaveDoc(p.documento, p.data);
    const atual = porChave.get(chave);
    if (atual) atual.push(p);
    else porChave.set(chave, [p]);
  }

  const blocosAlvo = empresa.blocos.filter((b) =>
    ['Despesas', 'Investimentos', 'Adiantamentos'].includes(b.titulo));

  /**
   * Chaves com uma perna de origem "de verdade" — nem contas a pagar, nem
   * caixa. Sem isso, uma transferência interna banco↔aplicações (as duas
   * pernas são caixa, nenhuma é origem) ficaria sem categoria e, no laço de
   * lançamento direto abaixo, seria empurrada duas vezes para "Não
   * Classificado" (uma por perna) — dinheiro que nem saiu da empresa.
   */
  const chavesComOrigem = new Set<string>();
  const categoriaPorChave = new Map<string, string>();
  for (const [chave, entradas] of porChave) {
    const origem = entradas.filter((p) => p.saldo > 0 && !ehContasPagar(p.conta) && !ehCaixa(p.conta));
    if (origem.length === 0) continue;
    chavesComOrigem.add(chave);
    for (const bloco of blocosAlvo) {
      const linha = bloco.linhas.find((l) => filtrarLinha(origem, l).length > 0);
      if (linha) {
        categoriaPorChave.set(chave, linha.rotulo);
        break;
      }
    }
  }

  const resultado: MovimentoRastreado[] = [];
  const chavesViaTitulo = new Set<string>();

  /**
   * `empresa.contasPagar` é um agrupamento amplo (ex.: todo o "2.1" na Serra
   * Bonita) que inclui, além de fornecedores/tributos, contas de trânsito —
   * ex.: AFAC lançado provisoriamente em 2.1.15 antes de reclassificado para
   * a conta de AFAC definitiva. Uma "baixa" nessas contas pode ser essa
   * reclassificação interna (outra perna também em conta a pagar/patrimônio),
   * não um pagamento de verdade. Só conta como caixa quando o documento+data
   * da baixa tem, de fato, uma perna em banco/aplicações — senão não é
   * dinheiro saindo do caixa, é só uma movimentação contábil interna.
   */
  const ehPagamentoReal = (documento: string, data: string) =>
    (porChave.get(chaveDoc(documento, data)) ?? []).some((p) => ehCaixa(p.conta));

  const acumulado = conciliar(todos, empresa);
  const baixaPorId = new Map(acumulado.baixas.map((b) => [b.id, b]));
  /**
   * Chave (documento+data) de cada baixa em contas a pagar — já processada
   * abaixo (via título ou como divergência). Uma baixa pode coincidir, por
   * acaso, com uma perna de origem irrelevante no mesmo documento+data (ex.:
   * um centavo de ajuste em conta de receita, no mesmo lançamento de uma
   * parcela de milhões de um terreno) — sem essa lista, o laço de
   * lançamento direto trataria essa coincidência como um pagamento novo e
   * contaria o valor da baixa (às vezes milhões) uma segunda vez.
   */
  const chavesDeBaixas = new Set(
    acumulado.baixas.map((b) => chaveDoc(b.documento, b.data)),
  );
  for (const t of acumulado.titulos) {
    const categoria = t.documento
      ? (categoriaPorChave.get(chaveDoc(t.documento, t.data)) ?? NAO_CLASSIFICADO)
      : NAO_CLASSIFICADO;
    if (t.documento) chavesViaTitulo.add(chaveDoc(t.documento, t.data));
    for (const b of t.baixas) {
      const documentoBaixa = baixaPorId.get(b.baixaId)?.documento ?? '';
      if (!ehPagamentoReal(documentoBaixa, b.data)) continue;
      resultado.push({ categoria, data: b.data, valor: arredonda(b.valor) });
    }
  }

  // Baixas que não fecharam com nenhum título — dinheiro que saiu do banco
  // (mesmo documento+data da baixa em contas a pagar) sem origem rastreável.
  for (const d of acumulado.divergencias) {
    const documentoBaixa = baixaPorId.get(d.id)?.documento ?? '';
    if (!ehPagamentoReal(documentoBaixa, d.data)) continue;
    resultado.push({ categoria: NAO_CLASSIFICADO, data: d.data, valor: arredonda(d.valor) });
  }

  for (const [chave, entradas] of porChave) {
    if (chavesViaTitulo.has(chave) || chavesDeBaixas.has(chave) || !chavesComOrigem.has(chave)) continue;
    const categoria = categoriaPorChave.get(chave) ?? NAO_CLASSIFICADO;
    // Só saldo < 0 é pagamento (saiu do banco). Um estorno/reembolso (saldo
    // > 0) já está refletido como entrada em `movimentoCaixa` — contá-lo
    // aqui também duplicaria o valor. Tarifa/IOF/IRRF/provisão já entram
    // como "Despesas Financeiras" (via `movimentoCaixa`, somado à parte na
    // tela) — contar aqui de novo também duplicaria.
    for (const p of entradas.filter((e) => ehCaixa(e.conta) && e.saldo < 0 && !ehDespesaFinanceira(e))) {
      resultado.push({ categoria, data: p.data, valor: arredonda(Math.abs(p.saldo)) });
    }
  }

  return resultado;
}

/** Blocos-alvo do rastreamento, na ordem definida em `empresa.blocos` (sem "Entradas"). */
const blocosRastreados = (empresa: Empresa): BlocoBalancete[] =>
  empresa.blocos.filter((b) => ['Adiantamentos', 'Despesas', 'Investimentos'].includes(b.titulo));

/**
 * Agrupa os movimentos rastreados por bloco de origem e categoria, dentro
 * do intervalo `[dataInicio, dataFim]` (extremos inclusos). `dataInicio`
 * omitido = posição acumulada desde o início (mesmo comportamento de
 * antes, usado por `porAnoCaixa`); informado = movimento só daquele
 * período — `rastrearPagamentos` sempre processa o razão inteiro (não dá
 * pra restringir a busca de baixas parceladas sem quebrar o rastreamento),
 * só o resultado final é filtrado pelo intervalo.
 */
export function montarBlocosCaixa(
  todos: Partida[],
  empresa: Empresa,
  dataFim: string,
  dataInicio?: string,
): BlocoCaixaCalculado[] {
  const movimentos = rastrearPagamentos(todos, empresa)
    .filter((m) => m.data <= dataFim && (!dataInicio || m.data >= dataInicio));

  const porCategoria = new Map<string, { valor: number; quantidade: number }>();
  for (const m of movimentos) {
    const atual = porCategoria.get(m.categoria) ?? { valor: 0, quantidade: 0 };
    atual.valor = arredonda(atual.valor + m.valor);
    atual.quantidade += 1;
    porCategoria.set(m.categoria, atual);
  }

  const blocos: BlocoCaixaCalculado[] = blocosRastreados(empresa).map((bloco) => {
    const linhas: LinhaCaixaCalculada[] = bloco.linhas.map((l) => {
      const d = porCategoria.get(l.rotulo) ?? { valor: 0, quantidade: 0 };
      return { rotulo: l.rotulo, valor: d.valor, quantidade: d.quantidade };
    });
    return { titulo: bloco.titulo, linhas, total: soma(linhas.map((l) => l.valor)) };
  });

  /**
   * O resíduo de reconciliação — a diferença entre o que de fato saiu do
   * caixa (`movimentoCaixa`, direto do razão banco/aplicações) e o que os
   * blocos acima conseguiram categorizar. Em vez de um bloco ambíguo de
   * "Não Classificado", ele é apresentado pelo sentido do dinheiro:
   * sobra de saída → "Outras Saídas"; sobra negativa (o rastreamento
   * atribuiu mais do que realmente saiu) → "Outras Entradas".
   */
  const partidasDoPeriodo = todos.filter((p) => p.data <= dataFim && (!dataInicio || p.data >= dataInicio));
  const pagamentosReais = movimentoCaixa(partidasDoPeriodo, empresa).saidas
    .find((l) => l.rotulo === 'Pagamentos')?.valor ?? 0;
  const totalCategorizado = soma(blocos.map((b) => b.total));
  const ajuste = arredonda(pagamentosReais - totalCategorizado);

  if (ajuste !== 0) {
    const itensNaoRastreados = porCategoria.get(NAO_CLASSIFICADO)?.quantidade ?? 0;
    const titulo = ajuste > 0 ? OUTRAS_SAIDAS : OUTRAS_ENTRADAS;
    const valor = Math.abs(ajuste);
    blocos.push({
      titulo,
      linhas: [{ rotulo: titulo, valor, quantidade: itensNaoRastreados }],
      total: valor,
    });
  }

  return blocos;
}


/** "Entradas e Saídas por Ano", em regime de caixa. */
export function porAnoCaixa(todos: Partida[], empresa: Empresa) {
  const anos = [...new Set(todos.map((p) => p.data.slice(0, 4)))].sort();
  const movimentos = rastrearPagamentos(todos, empresa);
  const categoriasPorBloco = new Map(
    blocosRastreados(empresa).map((b) => [b.titulo, new Set(b.linhas.map((l) => l.rotulo))]),
  );

  const totalDoBlocoNoAno = (titulo: string, ano: string) => {
    const categorias = categoriasPorBloco.get(titulo);
    if (!categorias) return 0;
    return soma(
      movimentos
        .filter((m) => m.data.startsWith(ano) && categorias.has(m.categoria))
        .map((m) => m.valor),
    );
  };

  const series = SERIES_ANO.map((s) => ({
    rotulo: s.rotulo,
    cor: s.cor,
    valores: anos.map((ano) => {
      if (s.bloco === 'Entradas') {
        const doAno = todos.filter((p) => p.data.startsWith(ano));
        return movimentoCaixa(doAno, empresa).totalEntradas;
      }
      return totalDoBlocoNoAno(s.bloco, ano);
    }),
  }));

  return { categorias: anos, series };
}
