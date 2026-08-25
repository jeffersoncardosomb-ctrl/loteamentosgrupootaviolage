import { type SupabaseClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/integrations/supabase/client.server';
import type { Database } from '@/integrations/supabase/types';
import type { Partida } from './types';
import type { LinhaImportacao } from './planilhaTipos';

/** Traduz um código de link secreto no id da empresa. Nulo quando inválido. */
export async function empresaPorToken(token: string): Promise<string | null> {
  if (!/^[a-f0-9]{16,128}$/i.test(token)) return null;
  const { data, error } = await supabaseAdmin
    .from('empresa_acesso')
    .select('empresa_id')
    .eq('token', token)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.empresa_id ?? null;
}

export async function listarAcessosDb() {
  const { data, error } = await supabaseAdmin
    .from('empresa_acesso')
    .select('empresa_id, token, atualizado_em');
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function regenerarTokenDb(empresaId: string) {
  const token = [...crypto.getRandomValues(new Uint8Array(32))]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  const { error } = await supabaseAdmin
    .from('empresa_acesso')
    .upsert({ empresa_id: empresaId, token }, { onConflict: 'empresa_id' });
  if (error) throw new Error(error.message);
  return { empresaId, token };
}

/** Lê a base inteira de uma empresa, em páginas de mil linhas. */
export async function lerPartidasPublicas(empresaId: string): Promise<Partida[]> {
  const supabase = supabaseAdmin;
  const tamanho = 1000;
  const linhas: Partida[] = [];
  for (let inicio = 0; ; inicio += tamanho) {
    const { data, error } = await supabase
      .from('partidas')
      .select('origem_id, data, conta, conta_nome, documento, complemento, quantidade, saldo')
      .eq('empresa_id', empresaId)
      .order('data', { ascending: true })
      .range(inicio, inicio + tamanho - 1);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;
    for (const l of data) {
      linhas.push({
        id: l.origem_id,
        data: l.data,
        conta: l.conta,
        contaNome: l.conta_nome,
        documento: l.documento,
        complemento: l.complemento,
        quantidade: Number(l.quantidade),
        saldo: Number(l.saldo),
      });
    }
    if (data.length < tamanho) break;
  }
  return linhas;
}


const chave = (empresaId: string, l: LinhaImportacao) =>
  [empresaId, l.origemId, l.data, l.conta, l.documento, l.complemento, l.quantidade, l.saldo]
    .join('|');

/**
 * Grava as linhas ignorando duplicatas — o índice único cobre
 * empresa_id + origem_id + data + conta + documento + complemento +
 * quantidade + saldo. O identificador da linha entra na chave para que
 * lançamentos legítimos idênticos (ex.: duas guias de mesmo valor) convivam
 * na base.
 */
export async function inserirPartidas(
  supabase: SupabaseClient<Database>,
  empresaId: string,
  linhas: LinhaImportacao[],
) {
  const vistos = new Set<string>();
  const unicas = linhas.filter((l) => {
    const k = chave(empresaId, l);
    if (vistos.has(k)) return false;
    vistos.add(k);
    return true;
  });

  let inseridas = 0;
  const lote = 500;
  for (let i = 0; i < unicas.length; i += lote) {
    const { data, error } = await supabase
      .from('partidas')
      .upsert(
        unicas.slice(i, i + lote).map((l) => ({
          empresa_id: empresaId,
          origem_id: l.origemId,
          data: l.data,
          conta: l.conta,
          conta_nome: l.contaNome,
          documento: l.documento,
          complemento: l.complemento,
          quantidade: l.quantidade,
          saldo: l.saldo,
        })),
        {
          onConflict: 'empresa_id,origem_id,data,conta,documento,complemento,quantidade,saldo',
          ignoreDuplicates: true,
        },
      )
      .select('id');
    if (error) throw new Error(error.message);
    inseridas += data?.length ?? 0;
  }

  return {
    recebidas: linhas.length,
    duplicadasNoArquivo: linhas.length - unicas.length,
    inseridas,
    jaExistiam: unicas.length - inseridas,
  };
}

interface PartidaHistorica {
  id: string;
  data: string;
  conta: string;
  contaNome: string;
  documento: string;
  complemento: string;
  quantidade: number;
  saldo: number;
}

const ARQUIVO_HISTORICO: Record<string, () => Promise<{ default: PartidaHistorica[] }>> = {
  'serra-bonita': () => import('../data/partidas.json'),
  'parque-das-estrelas': () => import('../data/parque-das-estrelas.json'),
};

/** Base histórica que acompanha o projeto, por empresa. */
export async function baseHistorica(empresaId: string): Promise<LinhaImportacao[]> {
  const carregar = ARQUIVO_HISTORICO[empresaId];
  if (!carregar) throw new Error(`Sem base histórica para a empresa "${empresaId}".`);
  const base = (await carregar()).default;
  return base.map((p) => ({
    origemId: p.id,
    data: p.data,
    conta: p.conta,
    contaNome: p.contaNome ?? '',
    documento: p.documento ?? '',
    complemento: p.complemento ?? '',
    quantidade: Number(p.quantidade ?? 0),
    saldo: Number(p.saldo ?? 0),
  }));
}
