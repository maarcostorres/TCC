'use client';

import { useCallback, useEffect, useState } from 'react';
import Alternativas from '@/components/Alternativas';
import Enunciado from '@/components/Enunciado';
import { rotuloDaFonte, type Alternativa, type QuestaoPublica } from '@/lib/enem';

type Correcao = { acertou: boolean; gabarito: Alternativa };

const QUANTIDADE = 20;

export default function EstudoPage() {
  const [questoes, setQuestoes] = useState<QuestaoPublica[]>([]);
  const [indice, setIndice] = useState(0);
  const [selecionada, setSelecionada] = useState<Alternativa | null>(null);
  const [correcao, setCorrecao] = useState<Correcao | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [corrigindo, setCorrigindo] = useState(false);
  const [gerandoFeedback, setGerandoFeedback] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const buscarQuestoes = useCallback(async () => {
    setCarregando(true);
    setErro(null);

    try {
      const resposta = await fetch(`/api/questions?limit=${QUANTIDADE}`);
      const corpo = await resposta.json();

      if (corpo.success) {
        setQuestoes(corpo.data);
      } else {
        setErro(corpo.error ?? 'Não foi possível carregar as questões.');
      }
    } catch {
      setErro('Falha de conexão ao buscar as questões.');
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void buscarQuestoes();
  }, [buscarQuestoes]);

  const questao = questoes[indice];

  async function responder() {
    if (!selecionada || !questao || corrigindo) return;

    setCorrigindo(true);
    setErro(null);

    try {
      // A correção vem do servidor: o gabarito não é enviado ao navegador
      // junto do enunciado. Também é aqui que a tentativa é registrada.
      const resposta = await fetch('/api/attempts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          origem: 'estudo',
          respostas: [{ questionKey: questao.questionKey, resposta: selecionada }],
        }),
      });
      const corpo = await resposta.json();

      if (!corpo.success) {
        setErro(corpo.error ?? 'Não foi possível registrar sua resposta.');
        return;
      }

      const primeira = corpo.correcoes[0];
      setCorrecao({ acertou: primeira.acertou, gabarito: primeira.gabarito });

      void gerarFeedback(questao.questionKey, selecionada);
    } catch {
      setErro('Falha de conexão ao enviar sua resposta.');
    } finally {
      setCorrigindo(false);
    }
  }

  async function gerarFeedback(questionKey: string, resposta: Alternativa) {
    setGerandoFeedback(true);

    try {
      const requisicao = await fetch('/api/ai/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionKey, resposta }),
      });
      const corpo = await requisicao.json();

      setFeedback(
        corpo.success ? corpo.feedback : 'Não foi possível gerar a explicação para esta questão.',
      );
    } catch {
      setFeedback('Não foi possível falar com o serviço de IA agora.');
    } finally {
      setGerandoFeedback(false);
    }
  }

  function proxima() {
    if (indice < questoes.length - 1) {
      setIndice(indice + 1);
      setSelecionada(null);
      setCorrecao(null);
      setFeedback(null);
    }
  }

  if (carregando) {
    return (
      <p className="flex items-center justify-center h-[60vh] border border-[#27272a] rounded-md bg-[#18181b] text-sm text-slate-400">
        Carregando questões...
      </p>
    );
  }

  if (erro && questoes.length === 0) {
    return (
      <div className="card-solid p-8 text-center space-y-4">
        <p role="alert" className="text-sm text-red-400">
          {erro}
        </p>
        <button type="button" onClick={() => void buscarQuestoes()} className="btn-secondary">
          Tentar novamente
        </button>
      </div>
    );
  }

  if (!questao) {
    return (
      <p className="card-solid p-8 text-center text-sm text-slate-400">
        Nenhuma questão encontrada. Sincronize o banco de questões pela tela inicial.
      </p>
    );
  }

  const ultima = indice === questoes.length - 1;

  return (
    <div className="max-w-3xl mx-auto pb-16">
      <div className="flex flex-wrap justify-between items-start gap-4 mb-8 border-b border-[#27272a] pb-6">
        <div>
          <h1 className="text-xl font-semibold text-white tracking-tight">
            Questão {indice + 1} de {questoes.length}
          </h1>
          <p className="text-xs text-slate-500 mt-1 uppercase tracking-widest font-semibold">
            {rotuloDaFonte(questao)} · questão {questao.questionNumber}
            {questao.disciplinas?.length ? ` · ${questao.disciplinas.join(', ')}` : ' · Ciências Humanas'}
          </p>
        </div>

        <p className="text-sm text-slate-400" aria-live="polite">
          {correcao ? (correcao.acertou ? 'Você acertou' : 'Você errou') : 'Sem resposta'}
        </p>
      </div>

      <Enunciado questao={questao} />

      <div className="my-8">
        <Alternativas
          alternativas={questao.alternatives}
          selecionada={selecionada}
          gabarito={correcao?.gabarito ?? null}
          bloqueada={corrigindo}
          onSelecionar={setSelecionada}
        />
      </div>

      <div className="pt-6 border-t border-[#27272a]">
        {!correcao ? (
          <>
            {erro && (
              <p role="alert" className="text-sm text-red-400 mb-4">
                {erro}
              </p>
            )}
            <button
              type="button"
              onClick={() => void responder()}
              disabled={!selecionada || corrigindo}
              className="btn-primary w-full"
            >
              {corrigindo ? 'Corrigindo...' : 'Responder'}
            </button>
          </>
        ) : (
          <div className="space-y-4 fade-in">
            <section
              aria-label="Explicação do tutor"
              className="border border-[#27272a] rounded-md bg-[#18181b] p-6"
            >
              <div className="flex flex-wrap justify-between items-center gap-2 mb-5">
                <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-widest">
                  Explicação do tutor
                </h2>
                <span className="text-[10px] bg-blue-900/30 text-blue-400 px-2 py-1 rounded border border-blue-900/50">
                  Llama 3.3 · Groq
                </span>
              </div>

              <p
                className={`text-base font-semibold mb-4 ${
                  correcao.acertou ? 'text-green-500' : 'text-red-400'
                }`}
              >
                {correcao.acertou
                  ? 'Resposta correta.'
                  : `Resposta incorreta — o gabarito é a alternativa ${correcao.gabarito}.`}
              </p>

              <div aria-live="polite" aria-busy={gerandoFeedback}>
                {gerandoFeedback ? (
                  <p className="text-sm text-slate-500 italic">Escrevendo a explicação...</p>
                ) : (
                  <div className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
                    {feedback}
                  </div>
                )}
              </div>
            </section>

            <div className="flex justify-end">
              {ultima ? (
                <button
                  type="button"
                  onClick={() => {
                    setIndice(0);
                    setSelecionada(null);
                    setCorrecao(null);
                    setFeedback(null);
                    void buscarQuestoes();
                  }}
                  className="btn-secondary text-sm"
                >
                  Carregar novas questões
                </button>
              ) : (
                <button type="button" onClick={proxima} className="btn-secondary text-sm">
                  Próxima questão
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
