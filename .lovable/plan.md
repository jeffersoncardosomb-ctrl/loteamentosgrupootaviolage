# Upload mensal da base contábil (área do administrador)

## O que muda para você

- O painel continua público, exatamente como está hoje.
- Passa a existir uma página de login e uma aba **Upload** que só aparece para `jeffersoncardosomb@gmail.com`.
- Nessa aba você escolhe o arquivo Excel do mês, vê uma prévia (quantas linhas, quais meses, quantas já existem na base) e confirma a importação.
- Lançamentos repetidos são ignorados: só entra o que é novo.
- Os 1.528 lançamentos atuais são migrados para o banco; o painel passa a ler de lá.

## Como fica o fluxo

```text
/            painel público (lê a base do banco)
/auth        login por e-mail e senha (admin)
/admin/upload   upload do Excel — só para o e-mail admin
```

## Backend (Lovable Cloud)

Será ativado o Lovable Cloud (banco, login e funções de servidor integrados).

Tabela `partidas`:

| campo | conteúdo |
|---|---|
| id | identificador do lançamento (P00001…) |
| data, conta, conta_nome | data ISO, código e nome da conta |
| documento, complemento | documento e histórico |
| quantidade, saldo | quantidade e saldo com sinal (+ débito / − crédito) |
| hash_linha | impressão digital da linha, com índice único — é o que impede duplicidade |

- Leitura pública (política `SELECT` para anônimo) — o painel não exige login.
- Escrita apenas para o administrador.
- Papéis em tabela separada `user_roles` + função `has_role`, com o e-mail do admin promovido na própria migração.
- Migração inicial insere os 1.528 lançamentos do JSON atual.

## Importação do Excel

- Leitura do arquivo com `xlsx` no navegador; envio das linhas já normalizadas para uma função de servidor autenticada, que confere o papel de admin antes de gravar.
- Reconhecimento das colunas pelos cabeçalhos da planilha que você já usa (data, conta, documento, complemento, quantidade, saldo/débito-crédito), com tela de conferência do mapeamento antes de confirmar.
- Datas em formato brasileiro ou serial do Excel são convertidas para ISO; valores com vírgula decimal são tratados.
- Inserção em lotes com `hash_linha` único: repetições caem fora sem erro.
- Ao final: quantas linhas foram lidas, inseridas e ignoradas, e o novo total da base.

## Detalhes técnicos

- Rota pública `/` passa a carregar as partidas por uma função de servidor pública (chave publicável, sem service role), mantendo `prepararPartidas` e toda a lógica de conciliação intacta.
- Rota protegida sob `_authenticated`, com verificação de papel admin também no servidor — a proteção da tela é apenas conveniência.
- Nenhuma alteração nas regras de balancete, conciliação ou aportes.

## Depois de aprovado

Você precisará criar a conta com o e-mail `jeffersoncardosomb@gmail.com` na tela de login uma única vez; o papel de admin já estará vinculado a esse e-mail.
