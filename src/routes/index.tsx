import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import PainelLage from "@/PainelLage";
import { listarPartidas } from "@/lib/partidas.functions";
import "@/styles/lage.css";

const title = "Painel LAGE — Serra Bonita Empreendimentos";
const description =
  "Painel financeiro Serra Bonita: balancete financeiro, contas pagas e a pagar, aportes dos sócios e resumo gerencial a partir da base contábil.";

const partidasQuery = queryOptions({
  queryKey: ["partidas"],
  queryFn: () => listarPartidas(),
});

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(partidasQuery),
  component: Pagina,
});

function Pagina() {
  const { data } = useSuspenseQuery(partidasQuery);
  return <PainelLage base={data} />;
}
