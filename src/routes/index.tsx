import { createFileRoute } from "@tanstack/react-router";
import ContasPagar from "@/pages/ContasPagar";
import "@/styles/loteamentos.css";

const title = "Contas a pagar — Serra Bonita";
const description =
  "Painel de loteamentos Serra Bonita: títulos em aberto, movimento mensal, aging e maiores credores a partir da base contábil.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
    ],
  }),
  component: ContasPagar,
});
