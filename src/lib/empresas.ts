/**
 * Parâmetros por empresa. Tudo que vem de contrato ou de decisão
 * gerencial — e não do razão — mora aqui. Os lançamentos em si vêm do
 * Supabase (`src/lib/partidas.server.ts`), não deste arquivo.
 */

export interface Socio {
  nome: string;
  /** trechos que aparecem no complemento do lançamento */
  chaves: string[];
  participacao: number;
}

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

export interface Empresa {
  id: string;
  nome: string;
  apelido: string;

  socios: Socio[];
  /** contas de capital integralizado, por sócio */
  contasAporte: string[];
  /** contas de adiantamento para futuro aumento de capital */
  contasAfac: string[];
  /** conta onde o capital é subscrito, quando existir separada das de aporte */
  contaCapitalSubscrito?: string;
  /**
   * Quando o histórico não nomeia o sócio mas a conta é exclusiva dele.
   * Tem prioridade sobre a busca por palavra-chave no complemento.
   */
  socioPorConta?: Record<string, string>;
  /** exceções por id de partida, para casos que nem conta nem histórico resolvem */
  socioManual?: Record<string, string>;

  /** prefixos que compõem contas a pagar */
  contasPagar: string[];
  /** subgrupos de contas a pagar a ignorar (provisões, ajustes) */
  contasPagarExceto?: string[];
  /** prefixos das disponibilidades — saldo bancário */
  contasBanco: string[];
  /** prefixos de aplicações financeiras, quando separadas do saldo bancário */
  contasAplicacoes?: string[];

  blocos: BlocoBalancete[];
  nomesConta?: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Serra Bonita
// ---------------------------------------------------------------------------

/**
 * A conta 1.1.09.01.0008 guarda tanto os custos do loteamento quanto a
 * compra dos terrenos. Os dois documentos de terreno saem para
 * Investimentos e o restante fica em Despesas.
 */
const SB_DOCS_TERRENO = ['000000029', '000000439'];

const SERRA_BONITA: Empresa = {
  id: 'serra-bonita',
  nome: 'Serra Bonita Empreendimentos Imobiliários Ltda',
  apelido: 'Serra Bonita',

  socios: [
    { nome: 'Palmeiras Emp. Imob.', chaves: ['PALMEIRAS'], participacao: 0.65 },
    { nome: 'Gissara Agropecuária', chaves: ['GISSARA'], participacao: 0.15 },
    { nome: 'Multimóveis Emp. e Part.', chaves: ['MULTIMOVEIS', 'MULTIMOVEL'], participacao: 0.1 },
    { nome: 'Royal Consultoria e Emp.', chaves: ['ROYAL'], participacao: 0.1 },
  ],
  contasAporte: ['2.4.01.01.0002'],
  contasAfac: ['2.4.02.01.0009'],
  contaCapitalSubscrito: '2.4.01.01.0001',
  /**
   * Reclassificações internas de 2023, sem nome de sócio no complemento.
   * Confirmado com a controladoria que se referem à Palmeiras.
   */
  socioManual: {
    P00287: 'Palmeiras Emp. Imob.', // 02/01/2023 · transferência de contas · (2.460,00) em capital a integralizar
    P00325: 'Palmeiras Emp. Imob.', // 31/07/2023 · para melhor contabilização · 2.584,28 em AFAC
    P00326: 'Palmeiras Emp. Imob.', // 31/07/2023 · contrapartida em capital a integralizar
  },

  contasPagar: ['2.1'],
  contasBanco: ['1.1.01.02.0001'],
  contasAplicacoes: ['1.1.01.03.0001'],

  /**
   * Classificação gerencial. Reproduz as medidas do Power BI sobre a base
   * nova, com decisões gerenciais pontuais registradas em cada linha.
   *
   * "Despesas administrativas e Gerais" foi restrita a 3.4.01.* — antes
   * também somava 4.1.01.02.* e 4.1.01.21.0012, que agora ficam de fora.
   *
   * "Custos do Loteamento" soma as contas 4.1.* (inclusive 4.1.01.21.0013,
   * por isso ela saiu de "Impostos e Taxas") com os lançamentos diretos em
   * 1.1.09.01.0008 — só os que têm número de documento (`exigeDocumento`).
   * Os lançamentos de apropriação mensal de custos nessa conta não têm
   * documento e ficam de fora, junto com a conta 4.2.01.01.0004
   * (contrapartida da apropriação): somar as duas pontas dobraria o valor.
   *
   * "Impostos e Taxas" considera só contas iniciadas em 3.4.02 ou 3.4.03
   * (hoje só existe 3.4.03 na base). 3.4.01.20 (antes contava aqui) foi
   * para "Despesas administrativas e Gerais". As contas 3.2.* (Arrendamento
   * Mercantil) e 3.8.* (IRPJ), que também contavam nesta linha, ficaram de
   * fora do relatório — não entram em nenhuma outra linha do balancete.
   *
   * A exclusão dos documentos de compra de terreno (`SB_DOCS_TERRENO`) é
   * restrita à conta 1.1.09.01.0008 porque o número do documento se repete
   * em outras contas com lançamentos sem relação — ex.: o documento
   * 000000029 é tanto a escritura do terreno (2020) quanto um pagamento
   * avulso em 4.1.01.02.0002 (2026).
   */
  blocos: [
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
          documentos: { lista: SB_DOCS_TERRENO, modo: 'excluir', contas: ['1.1.09'] },
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
          documentos: { lista: SB_DOCS_TERRENO, modo: 'somente' },
          natureza: 'D',
        },
      ],
    },
  ],

  nomesConta: {
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
  },
};

// ---------------------------------------------------------------------------
// Parque das Estrelas
// ---------------------------------------------------------------------------

const PARQUE_DAS_ESTRELAS: Empresa = {
  id: 'parque-das-estrelas',
  nome: 'Parque das Estrelas Empreendimentos Imobiliários Ltda',
  apelido: 'Parque das Estrelas',

  socios: [
    { nome: 'Palmeiras Empreendimentos', chaves: ['PALMEIRAS'], participacao: 0.7 },
    { nome: 'Mota & Ramos', chaves: ['MOTA'], participacao: 0.3 },
  ],
  contasAporte: ['2.4.01.01.0001'],
  contasAfac: ['2.2.30.15.0006', '2.2.30.15.0019'],
  /**
   * Aqui cada sócio tem conta própria de AFAC, e boa parte do histórico diz
   * apenas "INTEGRALIZACAO DE CAPITAL SOCIAL". A conta identifica o sócio.
   */
  socioPorConta: {
    '2.2.30.15.0006': 'Palmeiras Empreendimentos',
    '2.2.30.15.0019': 'Mota & Ramos',
  },

  /**
   * Só fornecedores e tributos. O grupo 2.1.15 guarda provisões (comissões
   * sobre vendas, ajuste de POC, terreneiro) e adiantamentos, que não são
   * títulos a pagar e distorceriam o saldo em R$ 21 milhões.
   */
  contasPagar: ['2.1.01', '2.1.05', '2.1.06'],
  contasBanco: ['1.1.01.02.0001'],
  contasAplicacoes: ['1.1.01.03.0001'],

  blocos: [
    {
      titulo: 'Entradas',
      linhas: [
        { rotulo: 'Receita de vendas', contas: ['3.1'], natureza: 'C' },
        { rotulo: 'Outras receitas operacionais', contas: ['3.6', '3.4.04'], natureza: 'C' },
        { rotulo: 'Recebimento de Aportes', contas: ['2.4', '2.2.30.15'], natureza: 'C' },
      ],
    },
    {
      titulo: 'Adiantamentos',
      linhas: [{ rotulo: 'Adiantamentos', contas: ['1.1.50'], natureza: 'D' }],
    },
    {
      titulo: 'Despesas',
      linhas: [
        { rotulo: 'Custos do Loteamento', contas: ['1.1.09', '4.2'], natureza: 'D' },
        { rotulo: 'Custo de Terreno', contas: ['3.2.05'], natureza: 'D' },
        { rotulo: 'Custo de Construção', contas: ['3.3'], natureza: 'D' },
        {
          rotulo: 'Despesas administrativas e Gerais',
          contas: ['3.4.01', '3.4.02', '4.1'],
          exceto: ['3.4.01.20', '4.1.01.21'],
          natureza: 'D',
        },
        {
          rotulo: 'Impostos e Taxas',
          contas: ['3.2.01', '3.8', '3.4.03', '3.4.01.20', '4.1.01.21'],
          natureza: 'D',
        },
      ],
    },
    {
      titulo: 'Investimentos',
      linhas: [{ rotulo: 'Cotas de capital Coopercred', contas: ['1.3.01'], natureza: 'D' }],
    },
  ],

  nomesConta: {
    '1.1.01.02.0001': 'Bancos conta movimento',
    '1.1.01.03.0001': 'Aplicações financeiras',
    '1.1.09.01.0007': 'Imóveis a comercializar — loteamento',
    '1.3.01.05.0001': 'Coopercred — quotas de capital',
    '2.1.01.01.0001': 'Fornecedores',
    '2.2.30.15.0006': 'AFAC — Palmeiras Empreendimentos',
    '2.2.30.15.0019': 'AFAC — Mota & Ramos',
    '2.4.01.01.0001': 'Capital social integralizado',
    '4.2.01.01.0004': 'Apropriação de custos ao loteamento',
  },
};

export const EMPRESAS: Empresa[] = [SERRA_BONITA, PARQUE_DAS_ESTRELAS];

export const EMPRESA_PADRAO = SERRA_BONITA;

export const empresaPorId = (id: string): Empresa =>
  EMPRESAS.find((e) => e.id === id) ?? EMPRESA_PADRAO;

/** Séries do gráfico "Entradas e Saídas por Ano". */
export const SERIES_ANO = [
  { rotulo: 'Despesas', bloco: 'Despesas', cor: 'var(--laranja)' },
  { rotulo: 'Entradas', bloco: 'Entradas', cor: 'var(--verde)' },
  { rotulo: 'Investimentos', bloco: 'Investimentos', cor: 'var(--pessego)' },
];
