'use client';

import { useEffect, useRef, useState } from 'react';

type Mensagem = {
  autor: 'aluno' | 'tutor';
  texto: string;
  latenciaMs?: number;
};

const SAUDACAO: Mensagem = {
  autor: 'tutor',
  texto:
    'Olá! Sou o tutor de Ciências Humanas da NextEducation. Pode perguntar sobre História, Geografia, Filosofia ou Sociologia — inclusive sobre algum tema que caiu numa questão e você não entendeu.',
};

const SUGESTOES = [
  'O que foi a Guerra Fria, em resumo?',
  'Qual a diferença entre êxodo rural e urbanização?',
  'Explique o conceito de anomia em Durkheim.',
];

export default function TutorPage() {
  const [mensagens, setMensagens] = useState<Mensagem[]>([SAUDACAO]);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const fimDaLista = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fimDaLista.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensagens, enviando]);

  async function enviar(pergunta: string) {
    const conteudo = pergunta.trim();
    if (!conteudo || enviando) return;

    setMensagens((atual) => [...atual, { autor: 'aluno', texto: conteudo }]);
    setTexto('');
    setEnviando(true);

    try {
      const resposta = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: conteudo }),
      });
      const corpo = await resposta.json();

      setMensagens((atual) => [
        ...atual,
        corpo.success
          ? { autor: 'tutor', texto: corpo.message, latenciaMs: corpo.latenciaMs }
          : { autor: 'tutor', texto: corpo.error ?? 'Não consegui responder agora.' },
      ]);
    } catch {
      setMensagens((atual) => [
        ...atual,
        { autor: 'tutor', texto: 'Falha na conexão com o servidor. Tente novamente.' },
      ]);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto h-[calc(100vh-9rem)] lg:h-[85vh] flex flex-col">
      <div className="mb-6 border-b border-[#27272a] pb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-white tracking-tight">
            Tutor IA — Ciências Humanas
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Tire dúvidas de História, Geografia, Filosofia e Sociologia.
          </p>
        </div>

        <p className="px-3 py-1 bg-[#18181b] border border-[#27272a] rounded text-xs font-semibold text-slate-400 flex items-center gap-2">
          <span className="w-1.5 h-1.5 bg-green-500 rounded-full" aria-hidden="true" />
          Llama 3.3 70B · Groq
        </p>
      </div>

      <div
        role="log"
        aria-label="Conversa com o tutor"
        aria-live="polite"
        className="flex-1 card-solid mb-4 p-4 sm:p-6 overflow-y-auto space-y-4 text-sm"
      >
        {mensagens.map((mensagem, i) => (
          <div
            key={i}
            className={`flex ${mensagem.autor === 'aluno' ? 'justify-end' : 'justify-start'} fade-in`}
          >
            <div
              className={`max-w-[85%] sm:max-w-[80%] p-4 rounded-md leading-relaxed whitespace-pre-wrap ${
                mensagem.autor === 'aluno'
                  ? 'bg-white text-black font-medium'
                  : 'bg-[#18181b] text-slate-300 border border-[#27272a]'
              }`}
            >
              {mensagem.autor === 'tutor' && (
                <p className="text-[10px] font-bold text-slate-500 mb-2 uppercase tracking-widest border-b border-[#27272a] pb-2 flex justify-between gap-3">
                  <span>Tutor NextEducation</span>
                  {mensagem.latenciaMs !== undefined && (
                    <span className="font-medium tabular-nums">
                      {(mensagem.latenciaMs / 1000).toFixed(1)}s
                    </span>
                  )}
                </p>
              )}
              {mensagem.texto}
            </div>
          </div>
        ))}

        {enviando && (
          <p className="bg-[#18181b] p-4 rounded-md border border-[#27272a] text-slate-500 italic text-sm inline-block">
            Pensando...
          </p>
        )}

        <div ref={fimDaLista} />
      </div>

      {mensagens.length === 1 && (
        <ul className="flex flex-wrap gap-2 mb-3">
          {SUGESTOES.map((sugestao) => (
            <li key={sugestao}>
              <button
                type="button"
                onClick={() => void enviar(sugestao)}
                className="text-xs text-slate-400 border border-[#27272a] bg-[#18181b] rounded-full px-3 py-1.5 hover:text-white hover:border-slate-600 transition-colors"
              >
                {sugestao}
              </button>
            </li>
          ))}
        </ul>
      )}

      <form
        onSubmit={(evento) => {
          evento.preventDefault();
          void enviar(texto);
        }}
        className="flex gap-3"
      >
        <label htmlFor="pergunta" className="sr-only">
          Sua dúvida
        </label>
        <input
          id="pergunta"
          value={texto}
          onChange={(evento) => setTexto(evento.target.value)}
          placeholder="Escreva sua dúvida aqui..."
          autoComplete="off"
          className="campo flex-1 min-w-0"
        />
        <button type="submit" disabled={enviando || !texto.trim()} className="btn-primary shrink-0">
          {enviando ? 'Aguarde' : 'Enviar'}
        </button>
      </form>
    </div>
  );
}
