/** Linha normalizada da planilha, pronta para gravar na base. */
export interface LinhaImportacao {
  origemId: string;
  data: string; // YYYY-MM-DD
  conta: string;
  contaNome: string;
  documento: string;
  complemento: string;
  quantidade: number;
  saldo: number;
}
