import { SERIES_ANO, type Empresa, type LinhaBalancete } from './empresas';
import { arredonda, soma } from './dados';
import type { Partida } from './types';

export interface LinhaCalculada {
  rotulo: string;
  valor: number;
  detalhes: { conta: string; nome: string; valor: number }[];
}

export interface BlocoCalculado {
  titulo: string;
  linhas: LinhaCalculada[];
  total: number;
}

/** Partidas que satisfazem a regra da linha (prefixos, exceções e documentos). */
export function filtrarLinha(partidas: Partida[], linha: LinhaBalancete): Partida[] {
  return partidas.filter((p) => {
    if (!linha.contas.some((c) => p.conta.startsWith(c))) return false;
    if (linha.exceto?.some((c) => p.conta.startsWith(c))) return false;
    if (linha.exigeDocumento && !p.documento) return false;
    if (linha.documentos) {
      const aplica =
        !linha.documentos.contas || linha.documentos.contas.some((c) => p.conta.startsWith(c));
      if (aplica) {
        const dentro = linha.documentos.lista.includes(p.documento);
        if (linha.documentos.modo === 'somente' && !dentro) return false;
        if (linha.documentos.modo === 'excluir' && dentro) return false;
      }
    }
    return true;
  });
}

function calcular(partidas: Partida[], linha: LinhaBalancete): LinhaCalculada {
  const sinal = linha.natureza === 'D' ? 1 : -1;
  const porConta = new Map<string, { nome: string; valor: number }>();

  for (const p of filtrarLinha(partidas, linha)) {
    const atual = porConta.get(p.conta) ?? { nome: p.contaNome, valor: 0 };
    atual.valor += p.saldo * sinal;
    if (!atual.nome) atual.nome = p.contaNome;
    porConta.set(p.conta, atual);
  }

  const detalhes = [...porConta.entries()]
    .map(([conta, d]) => ({ conta, nome: d.nome, valor: arredonda(d.valor) }))
    .filter((d) => Math.abs(d.valor) > 0.005)
    .sort((a, b) => b.valor - a.valor);

  return { rotulo: linha.rotulo, valor: soma(detalhes.map((d) => d.valor)), detalhes };
}

export function montarBalancete(partidas: Partida[], empresa: Empresa): BlocoCalculado[] {
  return empresa.blocos.map((bloco) => {
    const linhas = bloco.linhas.map((l) => calcular(partidas, l));
    return {
      titulo: bloco.titulo,
      linhas,
      total: soma(linhas.map((l) => l.valor)),
    };
  });
}

/** Saldo das disponibilidades: devedor, como manda a natureza da conta. */
export const saldoBancario = (partidas: Partida[], empresa: Empresa) =>
  soma(
    partidas
      .filter((p) => empresa.contasBanco.some((c) => p.conta.startsWith(c)))
      .map((p) => p.saldo),
  );

/** Saldo de aplicações bancárias: devedor, como manda a natureza da conta. */
export const saldoAplicacoes = (partidas: Partida[], empresa: Empresa) =>
  soma(
    partidas
      .filter((p) => (empresa.contasAplicacoes ?? []).some((c) => p.conta.startsWith(c)))
      .map((p) => p.saldo),
  );

export function porAno(partidas: Partida[], empresa: Empresa) {
  const anos = [...new Set(partidas.map((p) => p.data.slice(0, 4)))].sort();
  const series = SERIES_ANO.map((s) => ({
    rotulo: s.rotulo,
    cor: s.cor,
    valores: anos.map((ano) => {
      const doAno = partidas.filter((p) => p.data.startsWith(ano));
      return montarBalancete(doAno, empresa).find((b) => b.titulo === s.bloco)?.total ?? 0;
    }),
  }));
  return { categorias: anos, series };
}
