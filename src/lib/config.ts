/**
 * Parâmetros do empreendimento. Tudo que vem de contrato ou de decisão
 * gerencial — e não do razão — mora aqui.
 */

export const EMPRESA = {
  nome: 'Serra Bonita Empreendimentos Imobiliários Ltda',
  apelido: 'Serra Bonita',
  /** conferido contra a conta 2.4.01.01.0001 (capital subscrito) */
  capitalSocial: 12_200_000,
};

export interface Socio {
  nome: string;
  /** trechos que aparecem no complemento do lançamento */
  chaves: string[];
  participacao: number;
}

export const SOCIOS: Socio[] = [
  { nome: 'Palmeiras Emp. Imob.', chaves: ['PALMEIRAS'], participacao: 0.65 },
  { nome: 'Gissara Agropecuária', chaves: ['GISSARA'], participacao: 0.15 },
  { nome: 'Multimóveis Emp. e Part.', chaves: ['MULTIMOVEIS', 'MULTIMOVEL'], participacao: 0.1 },
  { nome: 'Royal Consultoria e Emp.', chaves: ['ROYAL'], participacao: 0.1 },
];

/**
 * Exceções de classificação de sócio, por id da partida.
 *
 * Use quando o complemento não traz o nome e a escrituração já está fechada.
 * O id aparece pronto para copiar no aviso da guia Aportes. Nome que não
 * existe na lista de sócios é ignorado, com alerta na tela — erro de digitação
 * não faz valor sumir.
 */
export const SOCIO_MANUAL: Record<string, string> = {
  // Reclassificações internas de 2023, sem nome de sócio no complemento.
  // Confirmado com a controladoria que se referem à Palmeiras.
  P00287: 'Palmeiras Emp. Imob.', // 02/01/2023 · transferência de contas · (2.460,00) em capital a integralizar
  P00325: 'Palmeiras Emp. Imob.', // 31/07/2023 · para melhor contabilização · 2.584,28 em AFAC
  P00326: 'Palmeiras Emp. Imob.', // 31/07/2023 · contrapartida em capital a integralizar
};

export const CONTAS = {
  /** capital subscrito conforme contrato social */
  capitalSubscrito: '2.4.01.01.0001',
  /** capital a integralizar — as integralizações dos sócios */
  aportes: '2.4.01.01.0002',
  /** adiantamento para futuro aumento de capital */
  afac: '2.4.02.01.0009',
  /** contas a pagar */
  pagar: '2.1',
  /** saldo bancário — bancos conta movimento */
  banco: '1.1.01.02.0001',
  /** saldo de aplicações bancárias */
  aplicacoes: '1.1.01.03.0001',
};

// ---------------------------------------------------------------------------
// Balancete financeiro
// ---------------------------------------------------------------------------

export interface LinhaBalancete {
  rotulo: string;
  /** prefixos que entram na linha */
  contas: string[];
  /** prefixos a excluir — permite recortar um subgrupo de dentro de outro */
  exceto?: string[];
  /**
   * Quando informado, só entram (ou saem) partidas destes documentos.
   * `contas`, se presente, restringe o filtro a esses prefixos — necessário
   * porque o número do documento não é único entre contas diferentes.
   */
  documentos?: { lista: string[]; modo: 'somente' | 'excluir'; contas?: string[] };
  /** quando true, só entram partidas com número de documento preenchido */
  exigeDocumento?: boolean;
  /** 'D' devedora (soma o saldo), 'C' credora (inverte o sinal) */
  natureza: 'D' | 'C';
}

export interface BlocoBalancete {
  titulo: string;
  linhas: LinhaBalancete[];
}

/**
 * Classificação gerencial. Reproduz as medidas do Power BI sobre a base nova.
 *
 * Cinco das seis linhas fecham no centavo. A exceção é "Impostos e Taxas",
 * R$ 576,09 abaixo do relatório antigo — diferença que vem das
 * reclassificações feitas entre as duas versões da base, não de erro de mapa.
 *
 * "Despesas administrativas e Gerais" foi restrita a 3.4.01.* por decisão
 * gerencial — antes também somava 4.1.01.02.* e 4.1.01.21.0012, que agora
 * ficam de fora, então essa linha não fecha mais com o relatório antigo.
 *
 * "Custos do Loteamento" também é decisão gerencial: soma as contas 4.1.*
 * (inclusive 4.1.01.21.0013, por isso ela saiu de "Impostos e Taxas") com os
 * lançamentos diretos em 1.1.09.01.0008 — só os que têm número de documento
 * (`exigeDocumento`). Os lançamentos de apropriação mensal de custos nessa
 * conta não têm documento e ficam de fora, junto com a conta 4.2.01.01.0004
 * (contrapartida da apropriação): somar as duas pontas dobraria o valor.
 *
 * "Impostos e Taxas" também é decisão gerencial: só contas iniciadas em
 * 3.4.02 ou 3.4.03 (hoje só existe 3.4.03 na base). 3.4.01.20 (antes
 * contava aqui) voltou para
 * "Despesas administrativas e Gerais". As contas 3.2.* (Arrendamento
 * Mercantil) e 3.8.* (IRPJ), que também contavam nesta linha, ficaram de
 * fora do relatório — não entram em nenhuma outra linha do balancete.
 *
 * Atenção ao 1.1.09.01.0008: além da apropriação mensal, ele guarda os dois
 * documentos de compra de terreno, que saem para Investimentos. A exclusão
 * desses documentos (`DOCS_TERRENO`) é restrita a essa conta porque o número
 * do documento se repete em outras contas com lançamentos sem relação — ex.:
 * o documento 000000029 é tanto a escritura do terreno (2020) quanto um
 * pagamento avulso em 4.1.01.02.0002 (2026).
 */
export const DOCS_TERRENO = ['000000029', '000000439'];

export const BLOCOS_BALANCETE: BlocoBalancete[] = [
  {
    titulo: 'Entradas',
    linhas: [
      { rotulo: 'Outras receitas operacionais', contas: ['3.1', '3.6', '3.4.04'], natureza: 'C' },
      { rotulo: 'Recebimento de Aportes', contas: ['2.4'], natureza: 'C' },
    ],
  },
  {
    titulo: 'Adiantamentos',
    linhas: [{ rotulo: 'Adiantamentos', contas: ['1.1.50.01.0001'], natureza: 'D' }],
  },
  {
    titulo: 'Despesas',
    linhas: [
      {
        rotulo: 'Custos do Loteamento',
        contas: ['4.1', '1.1.09'],
        documentos: { lista: DOCS_TERRENO, modo: 'excluir', contas: ['1.1.09'] },
        exigeDocumento: true,
        natureza: 'D',
      },
      {
        rotulo: 'Despesas administrativas e Gerais',
        contas: ['3.4.01'],
        natureza: 'D',
      },
      {
        rotulo: 'Impostos e Taxas',
        contas: ['3.4.02', '3.4.03'],
        natureza: 'D',
      },
    ],
  },
  {
    titulo: 'Investimentos',
    linhas: [
      { rotulo: 'Cotas de capital Coopercred', contas: ['1.3.01'], natureza: 'D' },
      {
        rotulo: 'Aquisição de Terrenos',
        contas: ['1.1.09', '1.3.02'],
        documentos: { lista: DOCS_TERRENO, modo: 'somente' },
        natureza: 'D',
      },
    ],
  },
];

/** Séries do gráfico "Entradas e Saídas por Ano". */
export const SERIES_ANO = [
  { rotulo: 'Despesas', bloco: 'Despesas', cor: 'var(--laranja)' },
  { rotulo: 'Entradas', bloco: 'Entradas', cor: 'var(--verde)' },
  { rotulo: 'Investimentos', bloco: 'Investimentos', cor: 'var(--pessego)' },
];

/**
 * Descrições de conta, para as linhas que a base não traz preenchidas
 * (a coluna NOMEPRODUTO vem em 234 das 1.528 partidas).
 */
export const NOMES_CONTA: Record<string, string> = {
  '1.1.01.02.0001': 'Bancos conta movimento',
  '1.1.01.03.0001': 'Aplicações financeiras',
  '1.1.09.01.0008': 'Imóveis a comercializar — loteamento',
  '1.1.50.01.0001': 'Adiantamentos a fornecedores',
  '1.3.01.05.0001': 'Coopercred — quotas de capital',
  '2.1.01.01.0001': 'Fornecedores',
  '2.1.15.01.0015': 'Contas a pagar — diversos',
  '2.4.01.01.0001': 'Capital social subscrito',
  '2.4.01.01.0002': '( - ) Capital a integralizar',
  '2.4.02.01.0009': 'AFAC — adiantamento para futuro aumento de capital',
  '4.2.01.01.0004': 'Apropriação de custos ao loteamento',
};
