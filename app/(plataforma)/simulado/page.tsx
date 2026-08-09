'use client';

import { useEffect, useRef, useState } from 'react';
import Alternativas from '@/components/Alternativas';
import Enunciado from '@/components/Enunciado';
import RevisaoSimulado from '@/components/RevisaoSimulado';
import { type Alternativa, type QuestaoPublica } from '@/lib/enem';

export type Correcao = {
  questionKey: string;
  resposta: Alternativa;
  gabarito: Alternativa;
  acertou: boolean;
};

type Fase = 'inicio' | 'prova' | 'resultado';

const TOTAL_QUESTOES = 5;
const DURACAO_SEGUNDOS = 5 * 60;

function formatarTempo(segundos: number): string {
  const minutos = Math.floor(segundos / 60);
  const resto = segundos % 60;

  return `${minutos}:${resto.toString().padStart(2, '0')}`;
}

export default function SimuladoPage() {
  const [fase, setFase] = useState<Fase>('inicio');
  const [questoes, setQuestoes] = useState<QuestaoPublica[]>([]);
  const [indice, setIndice] = useState(0);
  const [respostas, setRespostas] = useState<Record<string, Alternativa>>({});
  const [restante, setRestante] = useState(DURACAO_SEGUNDOS);
  const [correcoes, setCorrecoes] = useState<Correcao[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Ref para o encerramento automático não recriar o intervalo a cada segundo.
  const encerrarRef = useRef<() => void>(() => {});

  async function iniciar() {
    setCarregando(true);
    setErro(null);

    try {
      const resposta = await fetch(`/api/questions?limit=${TOTAL_QUESTOES}`);
      const corpo = await resposta.json();

      if (!corpo.success || corpo.data.length === 0) {
        setErro(corpo.error ?? 'Não há questões disponíveis. Sincronize o banco na tela inicial.');
        return;
      }

      setQuestoes(corpo.data);
      setIndice(0);
      setRespostas({});
      setCorrecoes([]);
      setRestante(DURACAO_SEGUNDOS);
      setFase('prova');
    } catch {
      setErro('Falha de conexão ao carregar a prova.');
    } finally {
      setCarregando(false);
    }
  }

  async function encerrar() {
    if (enviando) return;

    setEnviando(true);
    setErro(null);

    const enviadas = Object.entries(respostas).map(([questionKey, resposta]) => ({
      questionKey,
      resposta,
    }));

    // Uma prova sem nenhuma resposta não gera tentativa: não há o que corrigir.
    if (enviadas.length === 0) {
      setCorrecoes([]);
      setFase('resultado');
      setEnviando(false);
      return;
    }

    try {
      const resposta = await fetch('/api/attempts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ origem: 'simulado', respostas: enviadas }),
      });
      const corpo = await resposta.json();

      if (!corpo.success) {
        setErro(corpo.error ?? 'Não foi possível corrigir a prova.');
        return;
      }

      setCorrecoes(corpo.correcoes);
      setFase('resultado');
    } catch {
      setErro('Falha de conexão ao enviar a prova.');
    } finally {
      setEnviando(false);
    }
  }

  encerrarRef.current = () => void encerrar();

  useEffect(() => {
    if (fase !== 'prova') return;

    if (restante <= 0) {
      encerrarRef.current();
      return;
    }

    const cronometro = setTimeout(() => setRestante((valor) => valor - 1), 1000);

    return () => clearTimeout(cronometro);
  }, [fase, restante]);

  // ---------------------------------------------------------------- início
  if (fase === 'inicio') {
    return (
      <div className="max-w-2xl mx-auto mt-8 sm:mt-16 fade-in">
        <h1 className="text-2xl sm:text-3xl font-semibold text-white tracking-tight mb-3">
          Mini prova de Ciências Humanas
        </h1>
        <p className="text-sm text-slate-400 mb-8 leading-relaxed">
          Cinco questões oficiais do ENEM com tempo cronometrado. Ao final você vê o resultado e
          pode pedir a explicação de cada questão ao tutor. Procure um lugar tranquilo antes de
          começar.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          <div className="card-solid p-5">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 mb-1">
              Questões
            </p>
            <p className="text-lg font-semibold text-white">{TOTAL_QUESTOES}</p>
          </div>
          <div className="card-solid p-5">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 mb-1">
              Tempo
            </p>
            <p className="text-lg font-semibold text-white">{formatarTempo(DURACAO_SEGUNDOS)}</p>
          </div>
        </div>

        {erro && (
          <p role="alert" className="text-sm text-red-400 mb-4">
            {erro}
          </p>
        )}

        <button type="button" onClick={() => void iniciar()} disabled={carregando} className="btn-primary">
          {carregando ? 'Preparando...' : 'Começar mini prova'}
        </button>
      </div>
    );
  }

  // -------------------------------------------------------------- resultado
  if (fase === 'resultado') {
    return (
      <RevisaoSimulado
        questoes={questoes}
        respostas={respostas}
        correcoes={correcoes}
        tempoGasto={DURACAO_SEGUNDOS - restante}
        onRefazer={() => setFase('inicio')}
      />
    );
  }

  // ------------------------------------------------------------------ prova
  const questao = questoes[indice];
  const ultima = indice === questoes.length - 1;
  const respondidas = Object.keys(respostas).length;

  return (
    <div className="max-w-3xl mx-auto pb-16">
      <div className="flex flex-wrap justify-between items-center gap-4 mb-8 border-b border-[#27272a] pb-6">
        <div>
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">
            ENEM {questao.exam} · Ciências Humanas
          </p>
          <h1 className="text-sm font-semibold text-white mt-1">
            Questão {indice + 1} de {questoes.length} · {respondidas} respondida
            {respondidas === 1 ? '' : 's'}
          </h1>
        </div>

        <p
          role="timer"
          aria-live="off"
          className={`px-4 py-1.5 rounded-sm font-mono text-sm font-semibold border ${
            restante < 60
              ? 'bg-red-900/20 text-red-400 border-red-900/50'
              : 'bg-[#18181b] text-slate-300 border-[#27272a]'
          }`}
        >
          {formatarTempo(restante)}
        </p>
      </div>

      <Enunciado questao={questao} />

      <div className="my-8">
        <Alternativas
          alternativas={questao.alternatives}
          selecionada={respostas[questao.questionKey] ?? null}
          onSelecionar={(letra) =>
            setRespostas((atual) => ({ ...atual, [questao.questionKey]: letra }))
          }
        />
      </div>

      {erro && (
        <p role="alert" className="text-sm text-red-400 mb-4">
          {erro}
        </p>
      )}

      <div className="pt-6 border-t border-[#27272a] flex flex-wrap gap-3 justify-between">
        <button
          type="button"
          disabled={indice === 0}
          onClick={() => setIndice(indice - 1)}
          className="btn-secondary"
        >
          Anterior
        </button>

        {ultima ? (
          <button
            type="button"
            onClick={() => void encerrar()}
            disabled={enviando}
            className="btn-primary"
          >
            {enviando ? 'Corrigindo...' : 'Finalizar e ver resultado'}
          </button>
        ) : (
          <button type="button" onClick={() => setIndice(indice + 1)} className="btn-primary">
            Próxima
          </button>
        )}
      </div>
    </div>
  );
}
