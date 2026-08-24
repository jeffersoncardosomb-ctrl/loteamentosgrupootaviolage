import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';
import type { Partida } from './types';
import type { LinhaImportacao } from './planilhaTipos';

function clientePublico() {
  const key = process.env['SUPABASE_PUBLISHABLE_KEY']!;
  return createClient<Database>(process.env['SUPABASE_URL']!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith('sb_') && h.get('Authorization') === `Bearer ${key}`) {
          h.delete('Authorization');
        }
        h.set('apikey', key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

/** Lê a base inteira, em páginas de mil linhas. */
export async function lerPartidasPublicas(): Promise<Partida[]> {
  const supabase = clientePublico();
  const tamanho = 1000;
  const linhas: Partida[] = [];
  for (let inicio = 0; ; inicio += tamanho) {
    const { data, error } = await supabase
      .from('partidas')
      .select('origem_id, data, conta, conta_nome, documento, complemento, quantidade, saldo')
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

const chave = (l: LinhaImportacao) =>
  [l.origemId, l.data, l.conta, l.documento, l.complemento, l.quantidade, l.saldo].join('|');

/**
 * Grava as linhas ignorando duplicatas — o índice único cobre
 * origem_id + data + conta + documento + complemento + quantidade + saldo.
 * O identificador da linha entra na chave para que lançamentos legítimos
 * idênticos (ex.: duas guias de mesmo valor) convivam na base.
 */
export async function inserirPartidas(
  supabase: SupabaseClient<Database>,
  linhas: LinhaImportacao[],
) {
  const vistos = new Set<string>();
  const unicas = linhas.filter((l) => {
    const k = chave(l);
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
          onConflict: 'origem_id,data,conta,documento,complemento,quantidade,saldo',
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

/** Base histórica que acompanha o projeto (1.528 lançamentos). */
export async function baseHistorica(): Promise<LinhaImportacao[]> {
  const base = (await import('../data/partidas.json')).default as {
    id: string;
    data: string;
    conta: string;
    contaNome: string;
    documento: string;
    complemento: string;
    quantidade: number;
    saldo: number;
  }[];
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
