export interface Lancamento {
  id: string;
  sistema: string; // F = Financeiro (baixa) · T / C = Título, Compras (provisão)
  data: string; // YYYY-MM-DD
  contaDebito: string;
  descDebito: string;
  contaCredito: string;
  descCredito: string;
  valor: number;
  complemento: string;
  documento: string;
  centroCusto: string;
  filial: string;
  historico: string;
}

/** Título a pagar — crédito numa conta 2.1.x */
export interface Titulo {
  id: string;
  data: string;
  conta: string;
  contaNome: string;
  fornecedor: string;
  documento: string;
  complemento: string;
  centroCusto: string;
  valor: number;
  pago: number;
  saldo: number;
  dataQuitacao: string | null;
  baixas: BaixaAplicada[];
}

/** Baixa — débito numa conta 2.1.x */
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
  tipo: 'baixa sem titulo' | 'titulo sem baixa antiga';
  id: string;
  data: string;
  conta: string;
  contaNome: string;
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
  mes: string; // YYYY-MM
  rotulo: string; // "jul/26"
  titulosValor: number;
  baixasValor: number;
  saldoAberto: number; // saldo acumulado (créditos − débitos)
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
