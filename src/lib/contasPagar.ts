import { arredonda, soma } from './dados';
import type {
  FaixaAging,
  PosicaoMes,
  ResultadoConciliacao,
  Titulo,
  TituloEmAberto,
} from './types';

const MESES = [
  'jan', 'fev', 'mar', 'abr', 'mai', 'jun',
  'jul', 'ago', 'set', 'out', 'nov', 'dez',
];

export const mesDe = (data: string) => data.slice(0, 7);

export function rotuloMes(mes: string): string {
  const [ano = '', m = '1'] = mes.split('-');
  return `${MESES[Number(m) - 1]}/${ano.slice(2)}`;
}

export function fimDoMes(mes: string): string {
  const [ano = 0, m = 1] = mes.split('-').map(Number);
  const ultimo = new Date(Date.UTC(ano, m, 0)).getUTCDate();
  return `${mes}-${String(ultimo).padStart(2, '0')}`;
}

/**
 * Série mensal do saldo em aberto.
 *
 * O saldo de cada mês é o acumulado de créditos menos débitos em 2.1 até o
 * último dia do mês — ou seja, exatamente o saldo contábil do grupo. A
 * conciliação título a título serve para dizer QUAIS títulos compõem esse
 * saldo, não para calculá-lo.
 */
export function serieMensal(res: ResultadoConciliacao): PosicaoMes[] {
  const meses = new Set<string>();
  res.titulos.forEach((t) => meses.add(mesDe(t.data)));
  res.baixas.forEach((b) => meses.add(mesDe(b.data)));
  if (meses.size === 0) return [];

  const ordenados = [...meses].sort();
  const preenchidos = preencherIntervalo(ordenados[0]!, ordenados[ordenados.length - 1]!);

  let acumulado = 0;
  return preenchidos.map((mes) => {
    const corte = fimDoMes(mes);
    const titulosValor = soma(
      res.titulos.filter((t) => mesDe(t.data) === mes).map((t) => t.valor),
    );
    const baixasValor = soma(
      res.baixas.filter((b) => mesDe(b.data) === mes).map((b) => b.valor),
    );
    acumulado = arredonda(acumulado + titulosValor - baixasValor);
    return {
      mes,
      rotulo: rotuloMes(mes),
      titulosValor,
      baixasValor,
      saldoAberto: acumulado,
      titulosEmAberto: titulosEmAbertoEm(res.titulos, corte).length,
    };
  });
}

function preencherIntervalo(inicio: string, fim: string): string[] {
  const out: string[] = [];
  let [ano = 0, mes = 1] = inicio.split('-').map(Number);
  const [anoF = 0, mesF = 12] = fim.split('-').map(Number);
  while (ano < anoF || (ano === anoF && mes <= mesF)) {
    out.push(`${ano}-${String(mes).padStart(2, '0')}`);
    mes += 1;
    if (mes > 12) { mes = 1; ano += 1; }
  }
  return out;
}

/**
 * Títulos em aberto numa data de corte: nasceram até a data e ainda não
 * tinham sido quitados naquele momento. O valor considera só as baixas
 * ocorridas até o corte, para que a foto de um mês passado seja fiel.
 */
export function titulosEmAbertoEm(titulos: Titulo[], corte: string): TituloEmAberto[] {
  return titulos
    .filter((t) => t.data <= corte)
    .map((t) => {
      const pagoAteCorte = soma(
        t.baixas.filter((b) => b.data <= corte).map((b) => b.valor),
      );
      const saldo = arredonda(t.valor - pagoAteCorte);
      const dias = Math.round(
        (new Date(corte + 'T00:00:00').getTime() -
          new Date(t.data + 'T00:00:00').getTime()) / 86_400_000,
      );
      return {
        ...t,
        pago: pagoAteCorte,
        saldo,
        diasEmAberto: dias,
        faixa: faixaDe(dias),
      };
    })
    .filter((t) => t.saldo > 0.005)
    .sort((a, b) => b.saldo - a.saldo);
}

const FAIXAS: { rotulo: string; min: number; max: number | null }[] = [
  { rotulo: 'a vencer / até 30 dias', min: 0, max: 30 },
  { rotulo: '31 a 60 dias', min: 31, max: 60 },
  { rotulo: '61 a 90 dias', min: 61, max: 90 },
  { rotulo: '91 a 180 dias', min: 91, max: 180 },
  { rotulo: 'acima de 180 dias', min: 181, max: null },
];

export const faixaDe = (dias: number) =>
  FAIXAS.find((f) => dias >= f.min && (f.max === null || dias <= f.max))?.rotulo ??
  FAIXAS[0]!.rotulo;

export function aging(titulos: TituloEmAberto[]): FaixaAging[] {
  return FAIXAS.map((f) => {
    const doGrupo = titulos.filter((t) => t.faixa === f.rotulo);
    return {
      ...f,
      valor: soma(doGrupo.map((t) => t.saldo)),
      quantidade: doGrupo.length,
    };
  });
}

export function porFornecedor(titulos: TituloEmAberto[]) {
  const mapa = new Map<string, { nome: string; valor: number; qtd: number }>();
  titulos.forEach((t) => {
    const chave = t.fornecedor || '(sem identificação)';
    const atual = mapa.get(chave) ?? { nome: chave, valor: 0, qtd: 0 };
    atual.valor = arredonda(atual.valor + t.saldo);
    atual.qtd += 1;
    mapa.set(chave, atual);
  });
  return [...mapa.values()].sort((a, b) => b.valor - a.valor);
}

export function porConta(titulos: TituloEmAberto[]) {
  const mapa = new Map<string, { conta: string; nome: string; valor: number; qtd: number }>();
  titulos.forEach((t) => {
    const atual = mapa.get(t.conta) ?? {
      conta: t.conta, nome: t.contaNome, valor: 0, qtd: 0,
    };
    atual.valor = arredonda(atual.valor + t.saldo);
    atual.qtd += 1;
    mapa.set(t.conta, atual);
  });
  return [...mapa.values()].sort((a, b) => b.valor - a.valor);
}

export const brl = (v: number) =>
  // v === 0 também pega o -0 que sobra de arredondamento de ponto flutuante,
  // que sem isso o toLocaleString formata como "-R$ 0,00"
  (v === 0 ? 0 : v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export const brlCurto = (v: number) => {
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `${(v / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi`;
  if (abs >= 1_000) return `${(v / 1_000).toLocaleString('pt-BR', { maximumFractionDigits: 0 })} mil`;
  return v.toLocaleString('pt-BR', { maximumFractionDigits: 0 });
};

export const dataBR = (d: string) => d.split('-').reverse().join('/');
