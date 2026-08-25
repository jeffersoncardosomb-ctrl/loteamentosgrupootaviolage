# Links separados por empresa, com código secreto

Hoje existe um único painel público em `/` com um seletor de empresa, e qualquer pessoa vê as duas empresas. A mudança cria um endereço próprio e secreto para cada empresa, e mantém o painel com seletor apenas para você.

## Como vai ficar

- Cada empresa ganha um link do tipo `/p/9f3a7c2b8e1d4a6f...` (código longo, impossível de adivinhar).
- Quem abre esse link vê o painel exatamente como hoje, mas travado naquela empresa: sem seletor, sem link de Admin, sem acesso aos dados da outra empresa.
- O painel geral com seletor de empresas passa a exigir login e fica só para o administrador.
- Uma área no Admin lista os links de cada empresa, permite copiar e permite gerar um código novo (o link antigo para de funcionar na hora — útil se um sócio repassar o link para quem não deveria).

## Segurança

Hoje a tabela de lançamentos permite leitura pública direta pela API do backend, então mesmo escondendo o seletor os dados da outra empresa continuariam alcançáveis. A leitura pública será removida: os dados passam a ser servidos só pelo servidor do painel, depois de conferir o código do link. Sem código válido, nada é retornado.

Limite conhecido: link secreto não é login. Quem tiver o link entra. Por isso a opção de regenerar o código existe.

## Detalhes técnicos

1. **Migração**
   - Nova tabela `public.empresa_acesso`: `empresa_id` (único), `token` (texto único, 32 bytes aleatórios em hex), `criado_em`, `atualizado_em` + trigger.
   - GRANTs: nenhum para `anon`; `SELECT` para `authenticated` (admin lista os links via política que reusa a checagem de admin já usada em `partidas`); `ALL` para `service_role`.
   - RLS ligada; escrita só por admin.
   - INSERT literal de uma linha para `serra-bonita` e outra para `parque-das-estrelas` com tokens gerados por `encode(gen_random_bytes(32),'hex')`.
   - `DROP POLICY "leitura publica das partidas"` e revogar `SELECT` de `anon` em `partidas`.

2. **Servidor**
   - `src/lib/partidas.functions.ts`: nova server fn pública `listarPartidasPorToken({ token })` que carrega `supabaseAdmin` dentro do handler, resolve o token → `empresa_id`, e retorna os lançamentos daquela empresa. Token inválido → `notFound()`.
   - A `listarPartidas` atual (por `empresaId`) passa a exigir autenticação (`requireSupabaseAuth`) + checagem de admin, já que a leitura anônima acabou.
   - Nova server fn autenticada `listarAcessos()` e `regenerarToken({ empresaId })` para a tela de admin.

3. **Rotas**
   - Novo `src/routes/p.$codigo.tsx` (público, SSR): loader chama `listarPartidasPorToken`, renderiza `PainelLage` com `somenteLeitura`/`empresaFixa`. `head()` com `robots: noindex`, título e descrição próprios da empresa; `errorComponent` e `notFoundComponent` com mensagem "link inválido ou expirado".
   - `src/routes/index.tsx` deixa de ser público: o conteúdo vai para `src/routes/_authenticated/index.tsx` (mesmo comportamento e seletor de hoje) e `/` passa a redirecionar para `/auth` quando não houver sessão. `/` mantém `head()` próprio.

4. **UI**
   - `src/PainelLage.tsx` ganha a prop opcional `empresaFixa`: quando ligada, esconde o `<select>` de Empresa (mostrando só o nome da empresa) e o link "Admin". Nenhuma outra mudança visual.
   - `src/routes/_authenticated/upload.tsx` ganha um bloco "Links dos sócios" com o link completo de cada empresa, botão de copiar e botão "gerar novo código" com confirmação.
