import type { Empresa } from './empresas';
import { arredonda } from './dados';
import type { Partida } from './types';

export interface PosicaoSocio {
  nome: string;
  participacao: number;
  capitalSocial: number;
  aportes: number;
  aIntegralizar: number;
  afac: number;
  totalInvestido: number;
  participacaoRealizada: number;
}

export interface MovimentoAporte {
  id: string;
  data: string;
  socio: string;
  tipo: 'Aporte' | 'AFAC';
  documento: string;
  complemento: string;
  valor: number;
}

export interface QuadroAportes {
  socios: PosicaoSocio[];
  naoIdentificado: { aportes: number; afac: number; partidas: Partida[] };
  avisosMapa: string[];
  totais: {
    capitalSocial: number;
    aportes: number;
    aIntegralizar: number;
    afac: number;
    totalInvestido: number;
  };
  porAno: { ano: number; aportes: number; afac: number }[];
  movimentos: MovimentoAporte[];
}

const semAcento = (t: string) =>
  (t ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();

/**
 * Identifica o sócio de uma partida, nesta ordem:
 *   1. exceção manual pelo id
 *   2. conta exclusiva do sócio (quando a empresa tem uma conta por sócio)
 *   3. palavras-chave no complemento
 *
 * Sócio configurado que não existe no quadro societário é ignorado e a
 * partida volta para "a identificar" — erro de digitação não faz valor sumir.
 */
export function identificarSocio(empresa: Empresa, partida: Partida): string | null {
  const validos = new Set(empresa.socios.map((s) => s.nome));

  const manual = empresa.socioManual?.[partida.id];
  if (manual && validos.has(manual)) return manual;

  const porConta = empresa.socioPorConta?.[partida.conta];
  if (porConta && validos.has(porConta)) return porConta;

  const texto = semAcento(partida.complemento);
  const achado = empresa.socios.find((s) => s.chaves.some((c) => texto.includes(c)));
  return achado ? achado.nome : null;
}

export function conferirConfiguracao(empresa: Empresa, partidas: Partida[]): string[] {
  const validos = new Set(empresa.socios.map((s) => s.nome));
  const ids = new Set(partidas.map((p) => p.id));
  const avisos: string[] = [];
  Object.entries(empresa.socioManual ?? {}).forEach(([id, nome]) => {
    if (!validos.has(nome)) avisos.push(`${id}: "${nome}" não é um sócio cadastrado`);
    else if (!ids.has(id)) avisos.push(`${id}: não existe na base carregada`);
  });
  Object.entries(empresa.socioPorConta ?? {}).forEach(([conta, nome]) => {
    if (!validos.has(nome)) avisos.push(`${conta}: "${nome}" não é um sócio cadastrado`);
  });
  return avisos;
}

const casa = (conta: string, prefixos: string[]) => prefixos.some((c) => conta.startsWith(c));

/**
 * Aportes e AFAC por sócio.
 *
 * Crédito soma (o sócio pôs dinheiro), débito subtrai. Um débito de valor
 * igual ao capital social na conta de aportes é a contrapartida da
 * subscrição, e não entra no rateio.
 */
export function montarQuadroAportes(partidas: Partida[], empresa: Empresa): QuadroAportes {
  /**
   * Capital social: vem da conta de subscrição quando a empresa tem uma
   * (caso em que a conta de aportes é redutora e fecha em zero — Serra
   * Bonita); caso contrário, é o próprio saldo credor da conta de aportes
   * (Parque das Estrelas, que não tem conta de subscrição separada).
   */
  const contasCapital = empresa.contaCapitalSubscrito
    ? [empresa.contaCapitalSubscrito]
    : empresa.contasAporte;
  const capitalSocial = arredonda(
    -partidas.filter((p) => casa(p.conta, contasCapital)).reduce((a, p) => a + p.saldo, 0),
  );

  const movimentos: MovimentoAporte[] = [];
  const naoIdent: Partida[] = [];
  const acc = new Map(empresa.socios.map((s) => [s.nome, { aportes: 0, afac: 0 }]));
  let niAportes = 0;
  let niAfac = 0;

  for (const p of partidas) {
    const eAporte = casa(p.conta, empresa.contasAporte);
    const eAfac = casa(p.conta, empresa.contasAfac);
    if (!eAporte && !eAfac) continue;
    // contrapartida da subscrição de capital — não é dinheiro de sócio
    if (eAporte && p.saldo >= capitalSocial - 0.005 && capitalSocial > 0) continue;

    const valor = arredonda(-p.saldo);
    const tipo: MovimentoAporte['tipo'] = eAporte ? 'Aporte' : 'AFAC';
    const socio = identificarSocio(empresa, p);

    if (socio) {
      const alvo = acc.get(socio)!;
      if (tipo === 'Aporte') alvo.aportes = arredonda(alvo.aportes + valor);
      else alvo.afac = arredonda(alvo.afac + valor);
    } else {
      if (tipo === 'Aporte') niAportes = arredonda(niAportes + valor);
      else niAfac = arredonda(niAfac + valor);
      naoIdent.push(p);
    }

    movimentos.push({
      id: p.id,
      data: p.data,
      socio: socio ?? 'A identificar',
      tipo,
      documento: p.documento,
      complemento: p.complemento,
      valor,
    });
  }

  const totalAportes = arredonda(
    [...acc.values()].reduce((a, s) => a + s.aportes, 0) + niAportes,
  );
  const totalAfac = arredonda([...acc.values()].reduce((a, s) => a + s.afac, 0) + niAfac);

  /**
   * Com o capital total já 100% integralizado, o resíduo por sócio (até
   * R$ 50) costuma vir do acúmulo de muitos pequenos aportes que não
   * seguiram a proporção exata a cada lançamento — imaterial frente ao
   * capital social, mas soma zero. Resíduo maior que isso continua
   * aparecendo.
   */
  const TOLERANCIA_INTEGRALIZACAO = 50;
  const capitalTotalIntegralizado = totalAportes >= capitalSocial - 0.005;

  const socios: PosicaoSocio[] = empresa.socios.map((s) => {
    const d = acc.get(s.nome)!;
    const contratado = arredonda(capitalSocial * s.participacao);
    const aIntegralizarBruto = arredonda(contratado - d.aportes);
    const aIntegralizar =
      capitalTotalIntegralizado && Math.abs(aIntegralizarBruto) <= TOLERANCIA_INTEGRALIZACAO
        ? 0
        : aIntegralizarBruto;
    return {
      nome: s.nome,
      participacao: s.participacao,
      capitalSocial: contratado,
      aportes: d.aportes,
      aIntegralizar,
      afac: d.afac,
      totalInvestido: arredonda(d.aportes + d.afac),
      participacaoRealizada: totalAportes > 0 ? d.aportes / totalAportes : 0,
    };
  });

  const anos = new Map<number, { aportes: number; afac: number }>();
  movimentos.forEach((m) => {
    const ano = Number(m.data.slice(0, 4));
    const atual = anos.get(ano) ?? { aportes: 0, afac: 0 };
    if (m.tipo === 'Aporte') atual.aportes = arredonda(atual.aportes + m.valor);
    else atual.afac = arredonda(atual.afac + m.valor);
    anos.set(ano, atual);
  });

  return {
    socios,
    naoIdentificado: { aportes: niAportes, afac: niAfac, partidas: naoIdent },
    avisosMapa: conferirConfiguracao(empresa, partidas),
    totais: {
      capitalSocial,
      aportes: totalAportes,
      aIntegralizar: arredonda(socios.reduce((a, s) => a + s.aIntegralizar, 0)),
      afac: totalAfac,
      totalInvestido: arredonda(totalAportes + totalAfac),
    },
    porAno: [...anos.entries()].map(([ano, v]) => ({ ano, ...v })).sort((a, b) => a.ano - b.ano),
    movimentos: movimentos.sort((a, b) => b.data.localeCompare(a.data)),
  };
}
