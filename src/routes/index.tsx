import { createFileRoute } from "@tanstack/react-router";
import PainelLage from "@/PainelLage";
import "@/styles/lage.css";

const title = "Painel LAGE — Serra Bonita Empreendimentos";
const description =
  "Painel financeiro Serra Bonita: balancete financeiro, contas pagas e a pagar, aportes dos sócios e resumo gerencial a partir da base contábil.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
    ],
  }),
  component: PainelLage,
});
