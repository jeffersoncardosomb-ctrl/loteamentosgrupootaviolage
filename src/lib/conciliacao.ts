import type {
  Lancamento,
  Titulo,
  Baixa,
  Divergencia,
  RegraConciliacao,
  ResultadoConciliacao,
} from './types';

/**
 * MOTOR DE CONCILIAÇÃO DE CONTAS A PAGAR
 *
 * Regra do negócio:
 *  - Contas iniciadas em "2.1" são contas a pagar.
 *  - CRÉDITO em 2.1.x  = nasce o título (vem dos sistemas T ou C).
 *  - DÉBITO  em 2.1.x  = baixa/pagamento (vem do sistema F = Financeiro).
 *  - O financeiro acrescenta dígitos ao número da nota: o título 000000031
 *    é pago pelo documento 00000003101. Por isso a amarração é por
 *    semelhança de documento, não por igualdade.
 *  - Um título pode ser pago em parcelas (ex.: COMPRA TERRENO), então a
 *    alocação é por saldo remanescente, não por valor exato.
 */

const TOL = 0.005;
export const PREFIXO_PAGAR = '2.1';

/** Remove acento, pontuação, sufixos societários e o "000031 - " do começo. */
export function normalizarNome(texto: string): string {
  return (texto ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/^\s*\d+\s*-\s*/, '')
    .replace(/\[HIST\]/g, '')
    .replace(/[^A-Z0-9 ]/g, ' ')
    .replace(/\b(LTDA|ME|EPP|SA|EIRELI)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Só os dígitos, sem zeros à esquerda: "000000031" -> "31" */
export function normalizarDocumento(doc: string): string {
  const d = (doc ?? '').replace(/\D/g, '').replace(/^0+/, '');
  return d;
}

function tokens(texto: string): Set<string> {
  return new Set(texto.split(' ').filter((t) => t.length > 2));
}

/** Proporção de palavras em comum sobre o menor dos dois nomes. */
export function similaridade(a: string, b: string): number {
  const ta = tokens(a);
  const tb = tokens(b);
  if (ta.size === 0 || tb.size === 0) return 0;
  let comuns = 0;
  ta.forEach((t) => {
    if (tb.has(t)) comuns += 1;
  });
  return comuns / Math.min(ta.size, tb.size);
}

function diasEntre(de: string, ate: string): number {
  return Math.round(
    (new Date(ate + 'T00:00:00').getTime() - new Date(de + 'T00:00:00').getTime()) /
      86_400_000,
  );
}

interface Passe {
  regra: RegraConciliacao;
  /** janela em dias que o título pode ser posterior à baixa (defasagem de lançamento) */
  janela: number;
  /** aceita título de outra conta, desde que do mesmo grupo (ex.: 2.1.05) */
  contaLivreNoGrupo?: boolean;
  aceita: (t: Titulo, b: Baixa, sobraBaixa: number) => boolean;
}

/** "2.1.05.01.0008" -> "2.1.05" */
const grupoDe = (conta: string) => conta.split('.').slice(0, 3).join('.');

const PASSES: Passe[] = [
  {
    regra: 'documento',
    janela: 60,
    aceita: (t, b) => {
      const dt = normalizarDocumento(t.documento);
      const db = normalizarDocumento(b.documento);
      return dt !== '' && db.startsWith(dt) && db.length - dt.length <= 3;
    },
  },
  {
    regra: 'fornecedor+valor',
    janela: 120,
    aceita: (t, b, sobra) =>
      similaridade(t.fornecedor, b.fornecedor) >= 0.6 &&
      Math.abs(t.saldo - sobra) < TOL,
  },
  {
    regra: 'fornecedor',
    janela: 200,
    aceita: (t, b) => similaridade(t.fornecedor, b.fornecedor) >= 0.6,
  },
  {
    // último recurso: mesma conta, mais antigo primeiro. Cobre tributos
    // (DARF, ISSQN, IRRF), onde o complemento não traz fornecedor.
    regra: 'conta FIFO',
    janela: 400,
    aceita: () => true,
  },
  {
    // Tributos costumam ser provisionados numa conta (ex.: CSSL A PAGAR) e
    // baixados em outra do mesmo grupo (ex.: PIS/COFINS/CSLL - RETIDOS).
    // Sem nota fiscal, a prova é o valor idêntico dentro do mesmo grupo.
    regra: 'valor exato no grupo',
    janela: 120,
    contaLivreNoGrupo: true,
    aceita: (t, _b, sobra) => Math.abs(t.saldo - sobra) < TOL,
  },
];

export function conciliar(lancamentos: Lancamento[]): ResultadoConciliacao {
  const titulos: Titulo[] = lancamentos
    .filter((l) => l.contaCredito.startsWith(PREFIXO_PAGAR))
    .map((l) => ({
      id: l.id,
      data: l.data,
      conta: l.contaCredito,
      contaNome: l.descCredito,
      fornecedor: normalizarNome(l.complemento),
      documento: l.documento,
      complemento: l.complemento,
      centroCusto: l.centroCusto,
      valor: l.valor,
      pago: 0,
      saldo: l.valor,
      dataQuitacao: null,
      baixas: [],
    }))
    .sort((a, b) => a.data.localeCompare(b.data));

  const baixas: Baixa[] = lancamentos
    .filter((l) => l.contaDebito.startsWith(PREFIXO_PAGAR))
    .map((l) => ({
      id: l.id,
      data: l.data,
      conta: l.contaDebito,
      fornecedor: normalizarNome(l.complemento),
      documento: l.documento,
      complemento: l.complemento,
      valor: l.valor,
      aplicado: 0,
      sobra: l.valor,
    }))
    .sort((a, b) => a.data.localeCompare(b.data));

  for (const passe of PASSES) {
    for (const baixa of baixas) {
      if (baixa.sobra <= TOL) continue;

      const candidatos = titulos
        .filter((t) => {
          if (t.saldo <= TOL) return false;
          const mesmaConta = t.conta === baixa.conta;
          if (!mesmaConta && !(passe.contaLivreNoGrupo && grupoDe(t.conta) === grupoDe(baixa.conta)))
            return false;
          const dias = diasEntre(t.data, baixa.data);
          if (dias < -passe.janela || dias > 3650) return false;
          return passe.aceita(t, baixa, baixa.sobra);
        })
        .map((t) => ({ t, dist: Math.abs(diasEntre(t.data, baixa.data)) }))
        .sort((a, b) => a.dist - b.dist);

      for (const { t } of candidatos) {
        if (baixa.sobra <= TOL) break;
        const valor = Math.round(Math.min(baixa.sobra, t.saldo) * 100) / 100;
        if (valor <= TOL) continue;
        baixa.sobra = Math.round((baixa.sobra - valor) * 100) / 100;
        baixa.aplicado = Math.round((baixa.aplicado + valor) * 100) / 100;
        t.saldo = Math.round((t.saldo - valor) * 100) / 100;
        t.pago = Math.round((t.pago + valor) * 100) / 100;
        t.baixas.push({
          baixaId: baixa.id,
          data: baixa.data,
          valor,
          regra: passe.regra,
        });
        if (t.saldo <= TOL) t.dataQuitacao = baixa.data;
      }
    }
  }

  const divergencias: Divergencia[] = baixas
    .filter((b) => b.sobra > TOL)
    .map((b) => ({
      tipo: 'baixa sem titulo' as const,
      id: b.id,
      data: b.data,
      conta: b.conta,
      contaNome: '',
      descricao: b.complemento || '(sem complemento)',
      valor: b.sobra,
    }));

  const valorTitulos = soma(titulos.map((t) => t.valor));
  const valorBaixas = soma(baixas.map((b) => b.valor));

  return {
    titulos,
    baixas,
    divergencias,
    resumo: {
      qtdTitulos: titulos.length,
      valorTitulos,
      qtdBaixas: baixas.length,
      valorBaixas,
      saldoContabil: arredonda(valorTitulos - valorBaixas),
      baixasConciliadas: baixas.filter((b) => b.sobra <= TOL).length,
      valorNaoAlocado: soma(baixas.map((b) => b.sobra)),
    },
  };
}

export const arredonda = (v: number) => Math.round(v * 100) / 100;
export const soma = (vs: number[]) => arredonda(vs.reduce((a, b) => a + b, 0));
