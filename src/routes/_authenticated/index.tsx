import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import PainelLage from "@/PainelLage";
import { listarPartidas } from "@/lib/partidas.functions";
import { EMPRESA_PADRAO } from "@/lib/empresas";
import "@/styles/lage.css";

const title = "Painel LAGE — Grupo Otávio Lage";
const description =
  "Painel financeiro do Grupo Otávio Lage: balancete financeiro, contas pagas e a pagar, aportes dos sócios e resumo gerencial a partir da base contábil, por empresa.";

const partidasQuery = (empresaId: string) =>
  queryOptions({
    queryKey: ["partidas", empresaId],
    queryFn: () => listarPartidas({ data: { empresaId } }),
  });

export const Route = createFileRoute("/_authenticated/")({
  validateSearch: (search: Record<string, unknown>): { empresa?: string } => {
    const empresa = search['empresa'];
    return typeof empresa === 'string' ? { empresa } : {};
  },
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
    ],
  }),
  component: Pagina,
});

function Pagina() {
  const { empresa } = Route.useSearch();
  const empresaId = empresa ?? EMPRESA_PADRAO.id;
  const { data } = useSuspenseQuery(partidasQuery(empresaId));
  return <PainelLage base={data} empresaId={empresaId} />;
}
