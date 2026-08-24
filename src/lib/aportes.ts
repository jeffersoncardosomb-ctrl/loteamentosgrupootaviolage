import { CONTAS, EMPRESA, SOCIO_MANUAL, SOCIOS } from './config';
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
    capitalSubscrito: number;
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

const NOMES_VALIDOS = new Set(SOCIOS.map((s) => s.nome));

/**
 * Identifica o sócio de uma partida: primeiro o mapa de exceções por id,
 * depois as palavras-chave no complemento. Nome inválido no mapa é ignorado
 * e a partida cai em "a identificar".
 */
export function identificarSocio(complemento: string, id?: string): string | null {
  if (id) {
    const manual = SOCIO_MANUAL[id];
    if (manual && NOMES_VALIDOS.has(manual)) return manual;
  }
  const texto = semAcento(complemento);
  const achado = SOCIOS.find((s) => s.chaves.some((c) => texto.includes(c)));
  return achado ? achado.nome : null;
}

export function conferirMapaManual(partidas: Partida[]): string[] {
  const ids = new Set(partidas.map((p) => p.id));
  return Object.entries(SOCIO_MANUAL).flatMap(([id, nome]) => {
    if (!NOMES_VALIDOS.has(nome)) return [`${id}: "${nome}" não é um sócio cadastrado`];
    if (!ids.has(id)) return [`${id}: não existe na base carregada`];
    return [];
  });
}

/**
 * Aportes e AFAC por sócio.
 *
 * Crédito soma (o sócio pôs dinheiro), débito subtrai. Na conta de capital a
 * integralizar existe um débito único de R$ 12.200.000 que é a contrapartida da
 * subscrição do capital, sem sócio no complemento — ele fica fora do rateio,
 * como deve, e aparece à parte como capital subscrito.
 */
export function montarQuadroAportes(partidas: Partida[]): QuadroAportes {
  const movimentos: MovimentoAporte[] = [];
  const naoIdent: Partida[] = [];
  const acc = new Map(SOCIOS.map((s) => [s.nome, { aportes: 0, afac: 0 }]));
  let niAportes = 0;
  let niAfac = 0;

  const ehSubscricao = (p: Partida) =>
    p.conta === CONTAS.aportes && p.saldo >= EMPRESA.capitalSocial - 0.005;

  for (const p of partidas) {
    const eAporte = p.conta === CONTAS.aportes;
    const eAfac = p.conta === CONTAS.afac;
    if ((!eAporte && !eAfac) || ehSubscricao(p)) continue;

    const valor = arredonda(-p.saldo); // crédito soma
    const tipo: MovimentoAporte['tipo'] = eAporte ? 'Aporte' : 'AFAC';
    const socio = identificarSocio(p.complemento, p.id);

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

  const socios: PosicaoSocio[] = SOCIOS.map((s) => {
    const d = acc.get(s.nome)!;
    const capitalSocial = arredonda(EMPRESA.capitalSocial * s.participacao);
    return {
      nome: s.nome,
      participacao: s.participacao,
      capitalSocial,
      aportes: d.aportes,
      aIntegralizar: arredonda(capitalSocial - d.aportes),
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

  const capitalSubscrito = arredonda(
    -partidas
      .filter((p) => p.conta === CONTAS.capitalSubscrito)
      .reduce((a, p) => a + p.saldo, 0),
  );

  return {
    socios,
    naoIdentificado: { aportes: niAportes, afac: niAfac, partidas: naoIdent },
    avisosMapa: conferirMapaManual(partidas),
    totais: {
      capitalSocial: EMPRESA.capitalSocial,
      capitalSubscrito,
      aportes: totalAportes,
      aIntegralizar: arredonda(socios.reduce((a, s) => a + s.aIntegralizar, 0)),
      afac: totalAfac,
      totalInvestido: arredonda(totalAportes + totalAfac),
    },
    porAno: [...anos.entries()].map(([ano, v]) => ({ ano, ...v })).sort((a, b) => a.ano - b.ano),
    movimentos: movimentos.sort((a, b) => b.data.localeCompare(a.data)),
  };
}
