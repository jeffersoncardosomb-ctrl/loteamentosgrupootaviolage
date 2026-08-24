import { brlCurto } from '../lib/contasPagar';

// ---------------------------------------------------------------- barras
export interface SerieBarra {
  rotulo: string;
  cor: string;
  valores: number[];
}

export function GraficoBarras({
  categorias, series, altura = 210, rotuloValor = false,
}: {
  categorias: string[];
  series: SerieBarra[];
  altura?: number;
  rotuloValor?: boolean;
}) {
  const L = 620;
  const margemBaixo = 34;
  const margemTopo = rotuloValor ? 18 : 8;
  const alturaUtil = altura - margemBaixo - margemTopo;
  const maximo = Math.max(
    ...series.flatMap((s) => s.valores.map((v) => Math.abs(v))), 1,
  );
  const larguraGrupo = L / Math.max(categorias.length, 1);
  const larguraBarra = Math.min(26, (larguraGrupo * 0.7) / series.length);

  return (
    <>
      <svg className="grafico" viewBox={`0 0 ${L} ${altura}`} role="img"
        aria-label={`Gráfico de barras: ${series.map((s) => s.rotulo).join(', ')}`}>
        <line x1={0} y1={altura - margemBaixo} x2={L} y2={altura - margemBaixo}
          stroke="#dcdcdc" strokeWidth={1} />
        {categorias.map((cat, i) => {
          const centro = i * larguraGrupo + larguraGrupo / 2;
          const inicio = centro - (larguraBarra * series.length) / 2;
          return (
            <g key={cat}>
              {series.map((s, j) => {
                const v = Math.abs(s.valores[i] ?? 0);
                const h = (v / maximo) * alturaUtil;
                const x = inicio + j * larguraBarra;
                const y = altura - margemBaixo - h;
                return (
                  <g key={s.rotulo}>
                    <rect x={x} y={y} width={larguraBarra - 2} height={h} fill={s.cor}>
                      <title>{`${cat} · ${s.rotulo}: ${brlCurto(v)}`}</title>
                    </rect>
                    {rotuloValor && v > 0 && (
                      <text x={x + (larguraBarra - 2) / 2} y={y - 4}
                        textAnchor="middle" fontSize={10} fill="#555">
                        {brlCurto(v)}
                      </text>
                    )}
                  </g>
                );
              })}
              <text x={centro} y={altura - margemBaixo + 16} textAnchor="middle"
                fontSize={13} fontWeight={600} fill="#444">
                {cat}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="legenda">
        {series.map((s) => (
          <span key={s.rotulo}>
            <i style={{ background: s.cor }} />{s.rotulo}
          </span>
        ))}
      </div>
    </>
  );
}

// ---------------------------------------------------------------- rosca
export function Rosca({
  fatias, altura = 210,
}: {
  fatias: { rotulo: string; valor: number; cor: string }[];
  altura?: number;
}) {
  const total = fatias.reduce((a, f) => a + Math.abs(f.valor), 0) || 1;
  const R = 78;
  const r = 46;
  const cx = 110;
  const cy = altura / 2;
  let angulo = -Math.PI / 2;

  return (
    <>
      <svg className="grafico" viewBox={`0 0 320 ${altura}`} role="img"
        aria-label="Proporção entre contas pagas e a pagar">
        {fatias.map((f) => {
          const fracao = Math.abs(f.valor) / total;
          const varredura = fracao * Math.PI * 2;
          const fim = angulo + varredura;
          const grande = varredura > Math.PI ? 1 : 0;
          const p = (raio: number, ang: number) =>
            `${cx + raio * Math.cos(ang)} ${cy + raio * Math.sin(ang)}`;
          const d = fracao >= 0.9999
            ? `M ${cx - R} ${cy} A ${R} ${R} 0 1 1 ${cx + R} ${cy} A ${R} ${R} 0 1 1 ${cx - R} ${cy}
               M ${cx - r} ${cy} A ${r} ${r} 0 1 0 ${cx + r} ${cy} A ${r} ${r} 0 1 0 ${cx - r} ${cy}`
            : `M ${p(R, angulo)} A ${R} ${R} 0 ${grande} 1 ${p(R, fim)}
               L ${p(r, fim)} A ${r} ${r} 0 ${grande} 0 ${p(r, angulo)} Z`;
          const meio = angulo + varredura / 2;
          angulo = fim;
          return (
            <g key={f.rotulo}>
              <path d={d} fill={f.cor} fillRule="evenodd">
                <title>{`${f.rotulo}: ${brlCurto(f.valor)}`}</title>
              </path>
              {fracao > 0.04 && (
                <text
                  x={cx + (R + 14) * Math.cos(meio)}
                  y={cy + (R + 14) * Math.sin(meio)}
                  textAnchor={Math.cos(meio) < 0 ? 'end' : 'start'}
                  fontSize={10} fill="#555" dominantBaseline="middle"
                >
                  {(fracao * 100).toFixed(2).replace('.', ',')}%
                </text>
              )}
            </g>
          );
        })}
        {fatias.map((f, i) => (
          <g key={`lg-${f.rotulo}`} transform={`translate(232 ${cy - 18 + i * 20})`}>
            <circle cx={0} cy={0} r={4} fill={f.cor} />
            <text x={10} y={0} fontSize={11} fill="#333" dominantBaseline="middle">
              {f.rotulo}
            </text>
            <text x={10} y={13} fontSize={10} fill="#777" dominantBaseline="middle">
              {brlCurto(f.valor)}
            </text>
          </g>
        ))}
      </svg>
    </>
  );
}

// ---------------------------------------------------------------- medidor
export function Medidor({
  valor, maximo, rotulo, cor, formatar = brlCurto,
}: {
  valor: number;
  maximo: number;
  rotulo: string;
  cor: string;
  formatar?: (v: number) => string;
}) {
  const fracao = Math.max(0, Math.min(1, maximo > 0 ? valor / maximo : 0));
  const R = 60;
  const cx = 80;
  const cy = 74;
  const arco = (de: number, ate: number) => {
    const a1 = Math.PI + de * Math.PI;
    const a2 = Math.PI + ate * Math.PI;
    const grande = ate - de > 0.5 ? 1 : 0;
    return `M ${cx + R * Math.cos(a1)} ${cy + R * Math.sin(a1)}
            A ${R} ${R} 0 ${grande} 1 ${cx + R * Math.cos(a2)} ${cy + R * Math.sin(a2)}`;
  };

  return (
    <div>
      <p className="cartao__titulo" style={{ textAlign: 'center' }}>{rotulo}</p>
      <svg className="grafico" viewBox="0 0 160 96" role="img"
        aria-label={`${rotulo}: ${formatar(valor)} de ${formatar(maximo)}`}>
        <path d={arco(0, 1)} fill="none" stroke="#e6e6e6" strokeWidth={17} strokeLinecap="butt" />
        {fracao > 0 && (
          <path d={arco(0, fracao)} fill="none" stroke={cor} strokeWidth={17} strokeLinecap="butt" />
        )}
        <text x={cx} y={cy - 12} textAnchor="middle" fontSize={15} fontWeight={700} fill={cor}>
          {formatar(valor)}
        </text>
        <text x={cx} y={cy + 4} textAnchor="middle" fontSize={9} fill="#888">
          {(fracao * 100).toFixed(1).replace('.', ',')}% de {formatar(maximo)}
        </text>
        <text x={cx - R} y={cy + 15} textAnchor="middle" fontSize={8} fill="#999">0</text>
        <text x={cx + R} y={cy + 15} textAnchor="middle" fontSize={8} fill="#999">
          {formatar(maximo)}
        </text>
      </svg>
    </div>
  );
}
