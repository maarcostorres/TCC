'use client';

import { useState } from 'react';
import Link from 'next/link';
import Enunciado from '@/components/Enunciado';
import { ALTERNATIVAS, type Alternativa, type QuestaoPublica } from '@/lib/enem';
import type { Correcao } from '@/app/(plataforma)/simulado/page';

type Props = {
  questoes: QuestaoPublica[];
  respostas: Record<string, Alternativa>;
  correcoes: Correcao[];
  tempoGasto: number;
  onRefazer: () => void;
};

function formatarTempo(segundos: number): string {
  const minutos = Math.floor(segundos / 60);

  return `${minutos}:${(segundos % 60).toString().padStart(2, '0')}`;
}

/**
 * Revisão pós-prova: mostra o desempenho e permite pedir ao tutor a explicação
 * de cada questão. O feedback é buscado sob demanda, uma questão por vez, para
 * não disparar cinco chamadas ao modelo de uma só vez.
 */
export default function RevisaoSimulado({
  questoes,
  respostas,
  correcoes,
  tempoGasto,
  onRefazer,
}: Props) {
  const [explicacoes, setExplicacoes] = useState<Record<string, string>>({});
  const [carregando, setCarregando] = useState<string | null>(null);

  const porChave = new Map(correcoes.map((correcao) => [correcao.questionKey, correcao]));
  const acertos = correcoes.filter((correcao) => correcao.acertou).length;

  async function explicar(questionKey: string, resposta: Alternativa) {
    setCarregando(questionKey);

    try {
      const requisicao = await fetch('/api/ai/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionKey, resposta }),
      });
      const corpo = await requisicao.json();

      setExplicacoes((atual) => ({
        ...atual,
        [questionKey]: corpo.success ? corpo.feedback : 'Não foi possível gerar a explicação.',
      }));
    } catch {
      setExplicacoes((atual) => ({
        ...atual,
        [questionKey]: 'Falha de conexão com o serviço de IA.',
      }));
    } finally {
      setCarregando(null);
    }
  }

  return (
    <div className="max-w-3xl mx-auto pb-16 fade-in">
      <div className="text-center mb-10">
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">
          Mini prova finalizada
        </p>
        <h1 className="text-2xl font-semibold text-white">Seu resultado</h1>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-10">
        <div className="card-solid p-8 text-center">
          <p className="text-xs text-slate-400 uppercase font-semibold tracking-widest mb-2">
            Acertos
          </p>
          <p className="text-4xl font-semibold text-white">
            {acertos} <span className="text-lg text-slate-600">/ {questoes.length}</span>
          </p>
        </div>
        <div className="card-solid p-8 text-center">
          <p className="text-xs text-slate-400 uppercase font-semibold tracking-widest mb-2">
            Tempo usado
          </p>
          <p className="text-4xl font-semibold text-white tracking-tight">
            {formatarTempo(tempoGasto)}
          </p>
        </div>
      </div>

      <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-widest mb-4">
        Revisão das questões
      </h2>

      <div className="space-y-4 mb-10">
        {questoes.map((questao, posicao) => {
          const resposta = respostas[questao.questionKey];
          const correcao = porChave.get(questao.questionKey);
          const explicacao = explicacoes[questao.questionKey];

          return (
            <details key={questao.questionKey} className="card-solid overflow-hidden">
              <summary className="p-5 cursor-pointer flex flex-wrap items-center gap-3 justify-between text-sm">
                <span className="text-slate-200 font-medium">
                  Questão {posicao + 1} · ENEM {questao.exam}
                </span>

                <span
                  className={`text-xs font-semibold px-2 py-1 rounded ${
                    !correcao
                      ? 'bg-slate-800 text-slate-400'
                      : correcao.acertou
                        ? 'bg-green-500/10 text-green-400'
                        : 'bg-red-500/10 text-red-400'
                  }`}
                >
                  {!correcao
                    ? 'Em branco'
                    : correcao.acertou
                      ? `Acertou (${correcao.gabarito})`
                      : `Errou · marcou ${correcao.resposta}, gabarito ${correcao.gabarito}`}
                </span>
              </summary>

              <div className="px-5 pb-5 space-y-4 border-t border-[#27272a] pt-5">
                <Enunciado questao={questao} compacto />

                <ol className="space-y-1.5 text-sm">
                  {questao.alternatives.map((texto, i) => {
                    const letra = ALTERNATIVAS[i];
                    const ehGabarito = correcao?.gabarito === letra;
                    const ehEscolha = resposta === letra;

                    return (
                      <li
                        key={letra}
                        className={`flex gap-3 p-2 rounded ${
                          ehGabarito
                            ? 'text-green-400 bg-green-950/20'
                            : ehEscolha
                              ? 'text-red-400 bg-red-950/20'
                              : 'text-slate-400'
                        }`}
                      >
                        <span className="font-semibold shrink-0">{letra}</span>
                        <span className="leading-relaxed">{texto}</span>
                      </li>
                    );
                  })}
                </ol>

                {explicacao ? (
                  <div className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap border border-[#27272a] bg-[#18181b] rounded-md p-4">
                    {explicacao}
                  </div>
                ) : (
                  resposta && (
                    <button
                      type="button"
                      onClick={() => void explicar(questao.questionKey, resposta)}
                      disabled={carregando === questao.questionKey}
                      className="btn-secondary text-xs"
                    >
                      {carregando === questao.questionKey
                        ? 'Consultando o tutor...'
                        : 'Pedir explicação ao tutor'}
                    </button>
                  )
                )}
              </div>
            </details>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-3 justify-center">
        <button type="button" onClick={onRefazer} className="btn-primary">
          Fazer outra mini prova
        </button>
        <Link href="/stats" className="btn-secondary">
          Ver meu desempenho
        </Link>
      </div>
    </div>
  );
}
