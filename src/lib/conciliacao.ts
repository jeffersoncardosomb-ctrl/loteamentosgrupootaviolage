import type { Empresa } from './empresas';
import { arredonda, soma } from './dados';
import type {
  Baixa, Divergencia, Partida, RegraConciliacao, ResultadoConciliacao, Titulo,
} from './types';

/**
 * MOTOR DE CONCILIAÇÃO DE CONTAS A PAGAR
 *
 * Contas iniciadas em 2.1 são contas a pagar. No formato de partidas:
 *   saldo < 0 (crédito)  →  nasce o título
 *   saldo > 0 (débito)   →  baixa / pagamento
 *
 * O financeiro acrescenta dígitos ao número da nota: o título 000000031 é pago
 * pelo documento 00000003101. Por isso a amarração é por semelhança de
 * documento, nunca por igualdade. E como existem pagamentos parcelados, a
 * alocação é por saldo remanescente, não por valor exato.
 */

const TOL = 0.005;

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

/** Só os dígitos, sem zeros à esquerda: "000000031" → "31" */
export const normalizarDocumento = (doc: string) =>
  (doc ?? '').replace(/\D/g, '').replace(/^0+/, '');

const tokens = (t: string) => new Set(t.split(' ').filter((x) => x.length > 2));

export function similaridade(a: string, b: string): number {
  const ta = tokens(a);
  const tb = tokens(b);
  if (!ta.size || !tb.size) return 0;
  let comuns = 0;
  ta.forEach((t) => { if (tb.has(t)) comuns += 1; });
  return comuns / Math.min(ta.size, tb.size);
}

const diasEntre = (de: string, ate: string) =>
  Math.round(
    (new Date(`${ate}T00:00:00`).getTime() - new Date(`${de}T00:00:00`).getTime()) / 86_400_000,
  );

interface Passe {
  regra: RegraConciliacao;
  /** dias que o título pode ser posterior à baixa (defasagem de escrituração) */
  janela: number;
  aceita: (t: Titulo, b: Baixa, sobra: number) => boolean;
}

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
      similaridade(t.fornecedor, b.fornecedor) >= 0.6 && Math.abs(t.saldo - sobra) < TOL,
  },
  {
    regra: 'fornecedor',
    janela: 200,
    aceita: (t, b) => similaridade(t.fornecedor, b.fornecedor) >= 0.6,
  },
  {
    // último recurso: mesma conta, mais antigo primeiro. Cobre os tributos
    // (DARF, ISSQN, IRRF), onde o complemento não traz fornecedor.
    regra: 'conta FIFO',
    janela: 400,
    aceita: () => true,
  },
];

export function conciliar(partidas: Partida[], empresa: Empresa): ResultadoConciliacao {
  const doGrupo = partidas.filter(
    (p) =>
      empresa.contasPagar.some((c) => p.conta.startsWith(c)) &&
      !empresa.contasPagarExceto?.some((c) => p.conta.startsWith(c)),
  );

  const titulos: Titulo[] = doGrupo
    .filter((p) => p.saldo < -TOL)
    .map((p) => ({
      id: p.id,
      data: p.data,
      conta: p.conta,
      contaNome: p.contaNome,
      fornecedor: normalizarNome(p.complemento),
      documento: p.documento,
      complemento: p.complemento,
      valor: arredonda(-p.saldo),
      pago: 0,
      saldo: arredonda(-p.saldo),
      dataQuitacao: null,
      baixas: [],
    }))
    .sort((a, b) => a.data.localeCompare(b.data));

  const baixas: Baixa[] = doGrupo
    .filter((p) => p.saldo > TOL)
    .map((p) => ({
      id: p.id,
      data: p.data,
      conta: p.conta,
      fornecedor: normalizarNome(p.complemento),
      documento: p.documento,
      complemento: p.complemento,
      valor: arredonda(p.saldo),
      aplicado: 0,
      sobra: arredonda(p.saldo),
    }))
    .sort((a, b) => a.data.localeCompare(b.data));

  for (const passe of PASSES) {
    for (const baixa of baixas) {
      if (baixa.sobra <= TOL) continue;
      const candidatos = titulos
        .filter((t) => {
          if (t.saldo <= TOL || t.conta !== baixa.conta) return false;
          const dias = diasEntre(t.data, baixa.data);
          if (dias < -passe.janela || dias > 3650) return false;
          return passe.aceita(t, baixa, baixa.sobra);
        })
        .map((t) => ({ t, dist: Math.abs(diasEntre(t.data, baixa.data)) }))
        .sort((a, b) => a.dist - b.dist);

      for (const { t } of candidatos) {
        if (baixa.sobra <= TOL) break;
        const valor = arredonda(Math.min(baixa.sobra, t.saldo));
        if (valor <= TOL) continue;
        baixa.sobra = arredonda(baixa.sobra - valor);
        baixa.aplicado = arredonda(baixa.aplicado + valor);
        t.saldo = arredonda(t.saldo - valor);
        t.pago = arredonda(t.pago + valor);
        t.baixas.push({ baixaId: baixa.id, data: baixa.data, valor, regra: passe.regra });
        if (t.saldo <= TOL) t.dataQuitacao = baixa.data;
      }
    }
  }

  const divergencias: Divergencia[] = baixas
    .filter((b) => b.sobra > TOL)
    .map((b) => ({
      id: b.id,
      data: b.data,
      conta: b.conta,
      descricao: b.complemento || '(sem histórico)',
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

export { arredonda, soma };
