import * as XLSX from 'xlsx';
import type { LinhaImportacao } from './planilhaTipos';

/** Colunas esperadas na extração (mesmo formato da base atual). */
const COLUNAS = {
  data: 'DATA',
  conta: 'CONTA_CONTABIL',
  contaNome: 'NOMEPRODUTO',
  documento: 'DOCUMENTO',
  complemento: 'COMPLEMENTO',
  quantidade: 'QUANTIDADE',
  saldo: 'SALDO',
};

const texto = (v: unknown) => (v == null ? '' : String(v).trim());

const numero = (v: unknown) => {
  if (typeof v === 'number') return Math.round(v * 100) / 100;
  const limpo = texto(v).replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, '');
  const n = Number(limpo);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
};

/** Converte para YYYY-MM-DD aceitando data do Excel, ISO ou dd/mm/aaaa. */
function dataISO(v: unknown): string | null {
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, '0')}-${String(
      v.getDate(),
    ).padStart(2, '0')}`;
  }
  const s = texto(v);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const br = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  return null;
}

export interface ResultadoLeitura {
  linhas: LinhaImportacao[];
  ignoradas: number;
  colunasFaltando: string[];
}

export async function lerPlanilha(arquivo: File): Promise<ResultadoLeitura> {
  const buffer = await arquivo.arrayBuffer();
  const wb = XLSX.read(buffer, { cellDates: true });
  const nomeAba = wb.SheetNames[0];
  const aba = nomeAba ? wb.Sheets[nomeAba] : undefined;
  if (!aba) throw new Error('A planilha não tem nenhuma aba.');

  const registros = XLSX.utils.sheet_to_json<Record<string, unknown>>(aba, { defval: null });
  const primeiro = registros[0] ?? {};
  const cabecalhos = Object.keys(primeiro).map((c) => c.trim().toUpperCase());
  const colunasFaltando = [COLUNAS.data, COLUNAS.conta, COLUNAS.saldo].filter(
    (c) => !cabecalhos.includes(c),
  );
  if (colunasFaltando.length > 0) return { linhas: [], ignoradas: 0, colunasFaltando };

  const pegar = (r: Record<string, unknown>, nome: string) => {
    const chave = Object.keys(r).find((k) => k.trim().toUpperCase() === nome);
    return chave ? r[chave] : null;
  };

  // Identificador estável por arquivo: o mesmo arquivo reenviado gera os
  // mesmos identificadores, então nada duplica; mas duas linhas legítimas
  // idênticas dentro do arquivo recebem números diferentes e ambas entram.
  const prefixo = arquivo.name
    .replace(/\.[^.]+$/, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40) || 'PLANILHA';

  const linhas: LinhaImportacao[] = [];
  let ignoradas = 0;
  let ordem = 0;
  for (const r of registros) {
    ordem += 1;
    const conta = texto(pegar(r, COLUNAS.conta));
    const data = dataISO(pegar(r, COLUNAS.data));
    if (!conta || !data) {
      ignoradas += 1;
      continue;
    }
    linhas.push({
      origemId: `${prefixo}-${String(ordem).padStart(5, '0')}`,
      data,
      conta,
      contaNome: texto(pegar(r, COLUNAS.contaNome)).replace(/[-\s]+$/, ''),
      documento: texto(pegar(r, COLUNAS.documento)),
      complemento: texto(pegar(r, COLUNAS.complemento)),
      quantidade: numero(pegar(r, COLUNAS.quantidade)),
      saldo: numero(pegar(r, COLUNAS.saldo)),
    });
  }
  return { linhas, ignoradas, colunasFaltando: [] };
}
