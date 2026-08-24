import { useMemo } from 'react';
import type { PosicaoMes } from '../lib/types';
import { brlCurto } from '../lib/contasPagar';

interface Props {
  serie: PosicaoMes[];
  mesAtivo: string;
  onSelecionar: (mes: string) => void;
}

/**
 * Régua de meses — a linha do tempo desenhada como uma escala de agrimensor.
 * Cada mês é uma estaca; a profundidade da estaca é o saldo em aberto no
 * fechamento daquele mês. Estacas de janeiro são mais altas e recebem o ano,
 * como as marcas de dezena de uma trena.
 */
export function ReguaMeses({ serie, mesAtivo, onSelecionar }: Props) {
  const { maximo, escala } = useMemo(() => {
    const max = Math.max(...serie.map((m) => m.saldoAberto), 1);
    // raiz quadrada: um pico de R$ 5,9 mi não pode achatar os meses de R$ 3 mil
    return { maximo: max, escala: (v: number) => Math.sqrt(Math.max(v, 0) / max) };
  }, [serie]);

  const LARGURA_ESTACA = 15;
  const ALTURA = 128;
  const BASE = 30;
  const largura = serie.length * LARGURA_ESTACA;

  return (
    <figure className="regua">
      <figcaption className="regua__legenda">
        <span>Saldo em aberto no fechamento de cada mês</span>
        <span className="regua__maximo">
          pico {brlCurto(maximo)} · {serie[0]?.rotulo} a {serie[serie.length - 1]?.rotulo}
        </span>
      </figcaption>

      <div className="regua__rolagem">
        <svg
          width={largura}
          height={ALTURA}
          viewBox={`0 0 ${largura} ${ALTURA}`}
          role="group"
          aria-label="Linha do tempo do saldo em aberto"
        >
          {/* linha de referência da trena */}
          <line
            x1={0} y1={BASE} x2={largura} y2={BASE}
            stroke="var(--linha-forte)" strokeWidth={1}
          />

          {serie.map((m, i) => {
            const x = i * LARGURA_ESTACA + LARGURA_ESTACA / 2;
            const profundidade = escala(m.saldoAberto) * (ALTURA - BASE - 22);
            const janeiro = m.mes.endsWith('-01');
            const ativo = m.mes === mesAtivo;

            return (
              <g
                key={m.mes}
                className={`estaca ${ativo ? 'estaca--ativa' : ''}`}
                onClick={() => onSelecionar(m.mes)}
                role="button"
                tabIndex={0}
                aria-label={`${m.rotulo}: ${brlCurto(m.saldoAberto)} em aberto`}
                aria-pressed={ativo}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelecionar(m.mes);
                  }
                }}
              >
                <rect
                  x={i * LARGURA_ESTACA} y={0}
                  width={LARGURA_ESTACA} height={ALTURA}
                  fill="transparent"
                />
                {/* marca de escala acima da linha */}
                <line
                  x1={x} y1={janeiro ? BASE - 14 : BASE - 7} x2={x} y2={BASE}
                  stroke={ativo ? 'var(--marco)' : 'var(--linha-forte)'}
                  strokeWidth={janeiro || ativo ? 1.4 : 0.8}
                />
                {/* estaca: profundidade = saldo */}
                <line
                  x1={x} y1={BASE} x2={x} y2={BASE + profundidade}
                  stroke={ativo ? 'var(--marco)' : 'var(--tinta-3)'}
                  strokeWidth={ativo ? 5 : 3}
                  strokeLinecap="butt"
                />
                {m.saldoAberto > 0 && (
                  <circle
                    cx={x} cy={BASE + profundidade} r={ativo ? 3 : 1.6}
                    fill={ativo ? 'var(--marco)' : 'var(--tinta-3)'}
                  />
                )}
                {janeiro && (
                  <text
                    x={x} y={12} textAnchor="middle"
                    className="estaca__ano"
                  >
                    {m.mes.slice(2, 4)}
                  </text>
                )}
                {ativo && (
                  <text
                    x={x} y={ALTURA - 4} textAnchor="middle"
                    className="estaca__rotulo"
                  >
                    {m.rotulo}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </figure>
  );
}
