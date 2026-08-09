'use client';

type Sessao = { data: string; total: number; acertos: number; taxaAcerto: number };

type Props = { sessoes: Sessao[] };

const ALTURA = 180;
const ESPACO_ENTRE = 8;

function rotularData(iso: string): string {
  const [, mes, dia] = iso.split('-');

  return `${dia}/${mes}`;
}

/**
 * Aproveitamento por dia de estudo, desenhado em SVG.
 *
 * Feito à mão em vez de com uma biblioteca de gráficos para não acrescentar
 * dependência ao projeto — são barras simples, e o SVG escala sozinho na
 * largura do contêiner.
 */
export default function GraficoEvolucao({ sessoes }: Props) {
  if (sessoes.length === 0) return null;

  const largura = 100;
  const larguraBarra = (largura - ESPACO_ENTRE * (sessoes.length - 1)) / sessoes.length;

  return (
    <section className="card-solid p-6">
      <h2 className="text-sm font-semibold text-slate-200 mb-1">Evolução do aproveitamento</h2>
      <p className="text-xs text-slate-500 mb-6">
        Percentual de acertos em cada dia em que você estudou
        {sessoes.length === 1
          ? ' (um dia com atividade).'
          : ` (últimos ${sessoes.length} dias com atividade).`}
      </p>

      <div className="overflow-x-auto">
        <div className="min-w-[320px]">
          <svg
            viewBox={`0 0 ${largura} ${ALTURA}`}
            preserveAspectRatio="none"
            role="img"
            aria-label={`Gráfico de barras do aproveitamento diário. ${sessoes
              .map((s) => `${rotularData(s.data)}: ${s.taxaAcerto} por cento`)
              .join('. ')}`}
            className="w-full"
            style={{ height: ALTURA }}
          >
            {[25, 50, 75].map((marca) => (
              <line
                key={marca}
                x1={0}
                x2={largura}
                y1={ALTURA - (marca / 100) * ALTURA}
                y2={ALTURA - (marca / 100) * ALTURA}
                stroke="#27272a"
                strokeWidth={0.5}
              />
            ))}

            {sessoes.map((sessao, i) => {
              const alturaBarra = Math.max((sessao.taxaAcerto / 100) * ALTURA, 2);

              return (
                <rect
                  key={sessao.data}
                  x={i * (larguraBarra + ESPACO_ENTRE)}
                  y={ALTURA - alturaBarra}
                  width={larguraBarra}
                  height={alturaBarra}
                  fill={sessao.taxaAcerto >= 60 ? '#22c55e' : '#2563eb'}
                  rx={1}
                />
              );
            })}
          </svg>

          <ul className="flex mt-3 text-[10px] text-slate-500 tabular-nums">
            {sessoes.map((sessao) => (
              <li key={sessao.data} className="flex-1 text-center truncate px-0.5">
                {rotularData(sessao.data)}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <table className="sr-only">
        <caption>Aproveitamento por dia</caption>
        <thead>
          <tr>
            <th scope="col">Data</th>
            <th scope="col">Respondidas</th>
            <th scope="col">Acertos</th>
            <th scope="col">Aproveitamento</th>
          </tr>
        </thead>
        <tbody>
          {sessoes.map((sessao) => (
            <tr key={sessao.data}>
              <th scope="row">{sessao.data}</th>
              <td>{sessao.total}</td>
              <td>{sessao.acertos}</td>
              <td>{sessao.taxaAcerto}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
