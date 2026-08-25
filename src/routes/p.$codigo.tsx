import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import PainelLage from "@/PainelLage";
import { listarPartidasPorToken } from "@/lib/partidas.functions";
import "@/styles/lage.css";

const title = "Painel financeiro — Grupo Otávio Lage";
const description = "Painel financeiro do empreendimento, acesso exclusivo por link.";

const acessoQuery = (token: string) =>
  queryOptions({
    queryKey: ["partidas-token", token],
    queryFn: () => listarPartidasPorToken({ data: { token } }),
  });

export const Route = createFileRoute("/p/$codigo")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
    ],
  }),
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(acessoQuery(params.codigo)),
  errorComponent: LinkInvalido,
  notFoundComponent: LinkInvalido,
  component: Pagina,
});

function LinkInvalido() {
  return (
    <div className="mx-auto max-w-lg p-10 text-center">
      <h1 className="text-xl font-semibold text-foreground">Link inválido ou expirado</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Peça um novo link de acesso ao administrador do painel.
      </p>
      <Link to="/auth" className="mt-4 inline-block text-sm underline">
        Entrar como administrador
      </Link>
    </div>
  );
}

function Pagina() {
  const { codigo } = Route.useParams();
  const { data } = useSuspenseQuery(acessoQuery(codigo));
  return <PainelLage base={data.partidas} empresaId={data.empresaId} empresaFixa />;
}
