import { useMemo, useState } from 'react';
import { montarBalancete, porAno, saldoBancario } from '../lib/balancete';
import { conciliar } from '../lib/conciliacao';
import { brl } from '../lib/contasPagar';
import type { Partida } from '../lib/types';
import { GraficoBarras } from '../components/Graficos';

export function BalanceteFinanceiro({
  partidas, todos,
}: {
  partidas: Partida[];
  todos: Partida[];
}) {
  const blocos = useMemo(() => montarBalancete(partidas), [partidas]);
  const serie = useMemo(() => porAno(todos), [todos]);
  const saldoPagar = useMemo(() => conciliar(partidas).resumo.saldoContabil, [partidas]);
  const banco = useMemo(() => saldoBancario(partidas), [partidas]);
  const [abertos, setAbertos] = useState<Set<string>>(new Set());

  const alternar = (chave: string) => {
    const novo = new Set(abertos);
    novo.has(chave) ? novo.delete(chave) : novo.add(chave);
    setAbertos(novo);
  };

  return (
    <div className="colunas colunas--balancete">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {blocos.map((bloco) => (
          <div className="grupo" key={bloco.titulo}>
            <div className="grupo__cabecalho">
              <span>{bloco.titulo}</span>
              <span>Valor (R$)</span>
            </div>
            {bloco.linhas.map((linha) => {
              const chave = `${bloco.titulo}|${linha.rotulo}`;
              const aberto = abertos.has(chave);
              return (
                <div key={chave}>
                  <div className="grupo__linha">
                    <span className="grupo__rotulo">
                      <button
                        type="button"
                        onClick={() => alternar(chave)}
                        aria-expanded={aberto}
                        aria-label={`${aberto ? 'Recolher' : 'Expandir'} ${linha.rotulo}`}
                      >
                        {aberto ? '−' : '+'}
                      </button>
                      {linha.rotulo}
                    </span>
                    <span className="grupo__valor">{brl(linha.valor)}</span>
                  </div>
                  {aberto && linha.detalhes.map((d) => (
                    <div className="grupo__detalhe" key={d.conta}>
                      <span>{d.conta} · {d.nome}</span>
                      <span>{brl(d.valor)}</span>
                    </div>
                  ))}
                  {aberto && linha.detalhes.length === 0 && (
                    <div className="grupo__detalhe"><span>Sem movimento no período</span><span>—</span></div>
                  )}
                </div>
              );
            })}
            <div className="grupo__total">
              <span>Total</span>
              <span>{brl(bloco.total)}</span>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="colunas colunas--2">
          <div className="kpi">
            <div className="kpi__valor">{brl(saldoPagar)}</div>
            <div className="kpi__rotulo">Saldo Contas a Pagar</div>
          </div>
          <div className="kpi">
            <div className="kpi__valor">{brl(banco)}</div>
            <div className="kpi__rotulo">Saldo Bancário</div>
          </div>
        </div>

        <div className="cartao">
          <p className="cartao__titulo" style={{ textAlign: 'center' }}>
            Entradas e Saídas por Ano
          </p>
          <GraficoBarras categorias={serie.categorias} series={serie.series} altura={280} />
        </div>

        <div className="aviso">
          <div>
            <strong>Classificação editável</strong>
            As linhas acima são montadas por prefixo de conta em
            {' '}<code>src/lib/config.ts</code>. Ajuste ali para casar exatamente com as
            medidas do Power BI — o resto do painel acompanha sozinho.
          </div>
        </div>
      </div>
    </div>
  );
}
