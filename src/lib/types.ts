/**
 * FORMATO DA BASE
 *
 * Uma linha por partida. A conta vem numa coluna só e o saldo já traz o sinal:
 *   saldo > 0  →  débito
 *   saldo < 0  →  crédito
 *
 * Não existe mais coluna de débito e crédito separadas, nem sinal a normalizar.
 * A soma de todos os saldos tem que dar zero — é a prova da partida dobrada.
 */
export interface Partida {
  id: string;
  data: string; // YYYY-MM-DD
  conta: string;
  contaNome: string;
  documento: string;
  complemento: string;
  quantidade: number;
  saldo: number;
}

// --------------------------------------------------------------- contas a pagar

/** Título a pagar — partida credora numa conta 2.1.x */
export interface Titulo {
  id: string;
  data: string;
  conta: string;
  contaNome: string;
  fornecedor: string;
  documento: string;
  complemento: string;
  valor: number;
  pago: number;
  saldo: number;
  dataQuitacao: string | null;
  baixas: BaixaAplicada[];
}

/** Baixa — partida devedora numa conta 2.1.x */
export interface Baixa {
  id: string;
  data: string;
  conta: string;
  fornecedor: string;
  documento: string;
  complemento: string;
  valor: number;
  aplicado: number;
  sobra: number;
}

export interface BaixaAplicada {
  baixaId: string;
  data: string;
  valor: number;
  regra: RegraConciliacao;
}

export type RegraConciliacao =
  | 'documento'
  | 'fornecedor+valor'
  | 'fornecedor'
  | 'conta FIFO';

export interface Divergencia {
  id: string;
  data: string;
  conta: string;
  descricao: string;
  valor: number;
}

export interface ResultadoConciliacao {
  titulos: Titulo[];
  baixas: Baixa[];
  divergencias: Divergencia[];
  resumo: {
    qtdTitulos: number;
    valorTitulos: number;
    qtdBaixas: number;
    valorBaixas: number;
    saldoContabil: number;
    baixasConciliadas: number;
    valorNaoAlocado: number;
  };
}

export interface PosicaoMes {
  mes: string;
  rotulo: string;
  titulosValor: number;
  baixasValor: number;
  saldoAberto: number;
  titulosEmAberto: number;
}

export interface FaixaAging {
  rotulo: string;
  min: number;
  max: number | null;
  valor: number;
  quantidade: number;
}

export interface TituloEmAberto extends Titulo {
  diasEmAberto: number;
  faixa: string;
}

// --------------------------------------------------------------- integridade

export interface Integridade {
  totalPartidas: number;
  somaSaldos: number;
  fecha: boolean;
  documentosAbertos: { documento: string; diferenca: number; partidas: number }[];
}
