# Corrigir a perda de lançamentos idênticos na importação

## O que está acontecendo (confirmado)

Você está certo: a provisão foi lançada em duas linhas de R$ 56,42 (linhas 126 e 127 do arquivo). Elas são **idênticas** entre si — mesma data, mesma conta, mesmo documento, mesmo histórico e mesmo valor.

A regra que criei para "ignorar duplicidades" no upload trata linhas idênticas como repetição e grava apenas uma. Resultado:

- Arquivo de origem: **1.528** lançamentos
- Banco hoje: **1.525** lançamentos (3 perdidos, entre eles um dos 56,42)
- Soma dos saldos no banco: **−14,05** (deveria ser 0)

Por isso a aba "Contas Pagas e a Pagar" fecha em R$ 2.000 (ela usa outro caminho de cálculo) enquanto o saldo do grupo 2.1 aparece como 1.943,58.

## Como corrigir

1. **Mudar a regra de duplicidade**: a chave única passa a incluir o identificador da linha de origem (`origem_id`, ex. P00126/P00127). Duas linhas legítimas iguais convivem; reenviar o mesmo arquivo continua sem duplicar, porque o identificador da linha se repete.
2. **Numerar as linhas do Excel na importação**: hoje o `origem_id` vem vazio no upload de planilha. Passa a ser gerado como `ano-mês` do arquivo + número sequencial da linha, para que o mesmo arquivo reenviado gere sempre os mesmos identificadores.
3. **Recarregar a base histórica**: limpar e reimportar os 1.528 lançamentos do arquivo original, com a nova regra.
4. **Conferir**: soma dos saldos = 0, total = 1.528, e o saldo em aberto do grupo 2.1 em 31/07/2026 = R$ 2.000,00.

## Detalhes técnicos

- Migração: remover o índice único atual (`data, conta, documento, complemento, quantidade, saldo`) e criar índice único em `(origem_id, data, conta, documento, complemento, quantidade, saldo)`; `origem_id` deixa de aceitar vazio.
- `inserirPartidas`: `onConflict` passa a usar a nova chave; a deduplicação em memória usa a mesma chave.
- `lerPlanilha`: gera `origemId` sequencial estável por arquivo (prefixo do nome/competência + índice da linha).
- Nenhuma alteração nas regras de conciliação, aging ou balancete.
