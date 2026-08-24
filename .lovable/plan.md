# Por que o saldo a pagar mostra R$ 1.943,58

## O diagnóstico (confirmado na base)

O painel não está errando conta: ele mostra exatamente o saldo contábil do grupo 2.1, e esse saldo hoje é **-1.943,58** (453 lançamentos). A diferença de R$ 56,42 para os R$ 2.000 vem de um único caso na base:

| data | documento | conta | valor |
|---|---|---|---|
| 03/08/2021 | 000000082 | 2.1.01.01.0001 (título) | -56,42 |
| 17/08/2021 | 00000008201 (baixa) | 2.1.01.01.0001 | +112,84 |
| 17/08/2021 | 00000008201 | 1.1.01.02.0001 (banco) | -112,84 |

Cartório de Registro de Imóveis: saiu do banco R$ 112,84, mas só existe título de R$ 56,42 na extração. Ou seja, **falta uma segunda nota de R$ 56,42** (a contrapartida de despesa correspondente) na base importada. Essa baixa "sobrando" de 56,42 reduz o saldo a pagar de 2.000 para 1.943,58.

Confirmação adicional: a base inteira não fecha em partida dobrada — soma dos saldos = **-14,05** — sinal de que a extração veio incompleta em alguns pontos.

## O que fazer

1. **Confirmar com a contabilidade** o lançamento de 17/08/2021: se o pagamento de R$ 112,84 se refere a duas guias de R$ 56,42, falta o título da segunda no arquivo de origem.
2. **Corrigir na origem e reenviar**: incluir a linha faltante na planilha e subir pela tela de Upload — como duplicidades são ignoradas, só a linha nova entra, e o saldo passa a fechar em R$ 2.000.

## Alternativa, se a linha não puder ser corrigida na origem

Acrescentar ao painel um aviso explícito de "baixa sem título correspondente", listando data, documento, fornecedor e valor (aqui: 17/08/2021, 00000008201, Cartório, R$ 56,42), para que a diferença fique visível e explicada em vez de apenas alterar o total. Nenhuma regra de cálculo seria mudada — o saldo contábil continua sendo a verdade.

## Detalhes técnicos

- O saldo mostrado vem de `serieMensal` / conciliação sobre partidas com conta iniciada em `2.1`; a soma é puramente contábil, então qualquer ajuste tem que vir do dado, não do código.
- O aviso opcional usaria as `divergencias` que o motor de conciliação já produz (baixas com sobra não alocada), exibidas em `ContasPagasEPagar`.
