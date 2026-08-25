import type { Empresa } from './empresas';
import { arredonda, soma } from './dados';
import type { Partida } from './types';

export type CategoriaCaixa =
  | 'Ganhos de Aplicações Financeiras'
  | 'Recebimentos'
  | 'Recebimentos a Identificar'
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

/** Entrada sem nome nem natureza no histórico — não dá para saber a origem. */
const ehGenerico = (complemento: string) => {
  const c = semDocumento(complemento);
  return c === '' || /^CONTA:\s*[\d.\-]*$/i.test(c);
};

/**
 * Classifica um lançamento de banco/aplicações em uma categoria de caixa.
 * Ordem importa — a primeira regra que casar vence. Ajuste aqui se
 * aparecer um padrão de histórico novo que não se encaixe bem.
 */
function categoria(p: Partida): CategoriaCaixa {
  const c = semDocumento(p.complemento);
  if (p.saldo > 0) {
    if (/GANHO/i.test(c)) return 'Ganhos de Aplicações Financeiras';
    if (ehGenerico(c)) return 'Recebimentos a Identificar';
    return 'Recebimentos';
  }
  if (/TARIFA|TAR\s|DEBITO PACOTE|\bIOF\b|\bIRRF\b|PROVISAO/i.test(c)) return 'Despesas Financeiras';
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

  const acc = new Map<CategoriaCaixa, { valor: number; quantidade: number }>();
  for (const p of doCaixa) {
    if (ehTransferenciaInterna(p.complemento)) continue;
    const rotulo = categoria(p);
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
    ['Ganhos de Aplicações Financeiras', 'Recebimentos', 'Recebimentos a Identificar'] as const
  ).map(linha);
  const saidas = (['Pagamentos', 'Despesas Financeiras'] as const).map(linha);

  return {
    entradas,
    saidas,
    totalEntradas: soma(entradas.map((l) => l.valor)),
    totalSaidas: soma(saidas.map((l) => l.valor)),
  };
}
