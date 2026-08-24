import type { Integridade, Partida } from './types';
import type { Empresa } from './empresas';

export const arredonda = (v: number) => Math.round(v * 100) / 100;
export const soma = (vs: number[]) => arredonda(vs.reduce((a, b) => a + b, 0));

/** Preenche a descrição da conta quando a base não traz. */
export function prepararPartidas(brutas: Partida[], empresa: Empresa): Partida[] {
  const nomes = new Map<string, string>();
  brutas.forEach((p) => {
    if (p.contaNome && !nomes.has(p.conta)) nomes.set(p.conta, p.contaNome);
  });
  return brutas.map((p) => ({
    ...p,
    contaNome: p.contaNome || empresa.nomesConta?.[p.conta] || nomes.get(p.conta) || '',
  }));
}

/**
 * Prova da partida dobrada.
 *
 * A soma de todos os saldos tem que dar zero, e cada documento tem que fechar
 * sozinho. Documento em aberto quase sempre significa contrapartida que não
 * veio na extração — não é erro de cálculo do painel.
 */
export function conferirIntegridade(partidas: Partida[]): Integridade {
  const porDoc = new Map<string, { total: number; qtd: number }>();
  for (const p of partidas) {
    const chave = p.documento || '(sem documento)';
    const atual = porDoc.get(chave) ?? { total: 0, qtd: 0 };
    atual.total += p.saldo;
    atual.qtd += 1;
    porDoc.set(chave, atual);
  }
  const documentosAbertos = [...porDoc.entries()]
    .map(([documento, v]) => ({
      documento,
      diferenca: arredonda(v.total),
      partidas: v.qtd,
    }))
    .filter((d) => Math.abs(d.diferenca) > 0.005)
    .sort((a, b) => Math.abs(b.diferenca) - Math.abs(a.diferenca));

  const somaSaldos = soma(partidas.map((p) => p.saldo));
  return {
    totalPartidas: partidas.length,
    somaSaldos,
    fecha: Math.abs(somaSaldos) <= 0.005 && documentosAbertos.length === 0,
    documentosAbertos,
  };
}

/** Saldo devedor de um conjunto de prefixos (positivo = débito). */
export const saldoDevedor = (partidas: Partida[], prefixos: string[]) =>
  soma(
    partidas
      .filter((p) => prefixos.some((x) => p.conta.startsWith(x)))
      .map((p) => p.saldo),
  );

/** Saldo credor (positivo = crédito). */
export const saldoCredor = (partidas: Partida[], prefixos: string[]) =>
  arredonda(-saldoDevedor(partidas, prefixos));
