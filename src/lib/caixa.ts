import type { Empresa } from './empresas';
import { arredonda, soma } from './dados';
import type { Partida } from './types';

export type CategoriaCaixa =
  | 'Ganhos de Aplicações Financeiras'
  | 'Recebimento de Aportes'
  | 'Recebimentos'
  | 'Pagamentos'
  | 'Despesas Financeiras';

export interface LinhaCaixa {
  rotulo: CategoriaCaixa;
  valor: number;
  quantidade: number;
}

export interface MovimentoCaixa {
  entradas: LinhaCaixa[];
  saidas: LinhaCaixa[];
  totalEntradas: number;
  totalSaidas: number;
}

const semDocumento = (complemento: string) => (complemento ?? '').replace(/^\d+\s*-\s*/, '').trim();

/** Transferência entre banco e aplicações — mesmo valor debitado de um lado e creditado do outro. */
const ehTransferenciaInterna = (complemento: string) =>
  /^(APLICACAO|RESGATE\s*(DE\s*)?APLICACAO)\b/i.test(semDocumento(complemento));

/** Tarifas, IOF, IRRF e provisões sobre aplicação — custo do próprio banco, não uma despesa rastreável até uma categoria. */
export const ehDespesaFinanceira = (p: Partida) =>
  p.saldo < 0 && /TARIFA|TAR\s|DEBITO PACOTE|\bIOF\b|\bIRRF\b|PROVISAO/i.test(semDocumento(p.complemento));

const chaveDoc = (documento: string, data: string) => `${documento}|${data}`;

/**
 * Aporte de capital ou AFAC entrando no banco: mesma técnica de pareamento
 * por documento+data usada em `rastreioPagamentos.ts` — a contrapartida do
 * lançamento (mesmo documento, mesma data) cai numa conta de capital
 * social/AFAC da empresa. Sem isso, esse dinheiro fica indistinguível de um
 * recebimento comum de cliente dentro de "Recebimentos".
 */
function ehIntegralizacaoDeCapital(
  p: Partida,
  porChave: Map<string, Partida[]>,
  empresa: Empresa,
): boolean {
  if (!p.documento) return false;
  const contasCapital = [
    ...empresa.contasAporte,
    ...empresa.contasAfac,
    ...(empresa.contaCapitalSubscrito ? [empresa.contaCapitalSubscrito] : []),
    ...Object.keys(empresa.socioPorConta ?? {}),
  ];
  const entradas = porChave.get(chaveDoc(p.documento, p.data)) ?? [];
  return entradas.some((e) => contasCapital.some((c) => e.conta.startsWith(c)));
}

/**
 * Classifica um lançamento de banco/aplicações em uma categoria de caixa.
 * Ordem importa — a primeira regra que casar vence. Ajuste aqui se
 * aparecer um padrão de histórico novo que não se encaixe bem.
 */
function categoria(p: Partida, porChave: Map<string, Partida[]>, empresa: Empresa): CategoriaCaixa {
  const c = semDocumento(p.complemento);
  if (p.saldo > 0) {
    if (/GANHO/i.test(c)) return 'Ganhos de Aplicações Financeiras';
    if (ehIntegralizacaoDeCapital(p, porChave, empresa)) return 'Recebimento de Aportes';
    return 'Recebimentos';
  }
  if (ehDespesaFinanceira(p)) return 'Despesas Financeiras';
  return 'Pagamentos';
}

/**
 * Movimento de caixa do período: soma o que entrou e o que saiu do banco +
 * aplicações financeiras, por natureza do lançamento. Ao contrário do
 * balancete (regime de competência), aqui a origem é só a própria conta de
 * disponibilidades — por isso fecha exatamente com a posição de caixa,
 * sem precisar reconciliar nada.
 */
export function movimentoCaixa(partidas: Partida[], empresa: Empresa): MovimentoCaixa {
  const contasCaixa = [...empresa.contasBanco, ...(empresa.contasAplicacoes ?? [])];
  const doCaixa = partidas.filter((p) => contasCaixa.some((c) => p.conta.startsWith(c)));

  const porChave = new Map<string, Partida[]>();
  for (const p of partidas) {
    if (!p.documento) continue;
    const chave = chaveDoc(p.documento, p.data);
    const atual = porChave.get(chave);
    if (atual) atual.push(p);
    else porChave.set(chave, [p]);
  }

  const acc = new Map<CategoriaCaixa, { valor: number; quantidade: number }>();
  for (const p of doCaixa) {
    if (ehTransferenciaInterna(p.complemento)) continue;
    const rotulo = categoria(p, porChave, empresa);
    const atual = acc.get(rotulo) ?? { valor: 0, quantidade: 0 };
    atual.valor = arredonda(atual.valor + p.saldo);
    atual.quantidade += 1;
    acc.set(rotulo, atual);
  }

  const linha = (rotulo: CategoriaCaixa): LinhaCaixa => {
    const d = acc.get(rotulo) ?? { valor: 0, quantidade: 0 };
    return { rotulo, valor: Math.abs(d.valor), quantidade: d.quantidade };
  };

  const entradas = (
    ['Ganhos de Aplicações Financeiras', 'Recebimento de Aportes', 'Recebimentos'] as const
  ).map(linha);
  const saidas = (['Pagamentos', 'Despesas Financeiras'] as const).map(linha);

  return {
    entradas,
    saidas,
    totalEntradas: soma(entradas.map((l) => l.valor)),
    totalSaidas: soma(saidas.map((l) => l.valor)),
  };
}
