'use client';

import React, { useState, useRef, useEffect } from 'react';

type Message = {
  role: 'user' | 'ai';
  text: string;
};

export default function TutorPage() {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'ai', text: 'Olá! Sou o Tutor IA da NextEducation. Estou pronto para responder suas dúvidas de Ciências Humanas — História, Geografia, Sociologia e Filosofia. Como posso ajudar?' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userText = input.trim();
    setMessages(prev => [...prev, { role: 'user', text: userText }]);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userText }),
      });
      const data = await res.json();
      if (data.success) {
        setMessages(prev => [...prev, { role: 'ai', text: data.message }]);
      } else {
        setMessages(prev => [...prev, { role: 'ai', text: 'Erro ao processar sua pergunta. Tente novamente.' }]);
      }
    } catch {
      setMessages(prev => [...prev, { role: 'ai', text: 'Falha na conexão com o servidor. Tente novamente.' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto h-[85vh] flex flex-col">
      {/* Header */}
      <div className="mb-6 border-b border-[#27272a] pb-6 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white tracking-tight">Tutor IA — Ciências Humanas</h1>
          <p className="text-sm text-slate-500 mt-1">Tire suas dúvidas de História, Geografia, Sociologia e Filosofia.</p>
        </div>
        <div className="px-3 py-1 bg-[#18181b] border border-[#27272a] rounded text-xs font-semibold text-slate-400 flex items-center gap-2">
          <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
          Groq — Llama 3.3 70B
        </div>
      </div>

      {/* Janela de mensagens */}
      <div className="flex-1 card-solid mb-4 p-6 overflow-y-auto space-y-4 text-sm">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} fade-in`}>
            <div className={`max-w-[80%] p-4 rounded-md leading-relaxed whitespace-pre-wrap ${
              msg.role === 'user'
                ? 'bg-white text-black font-medium'
                : 'bg-[#18181b] text-slate-300 border border-[#27272a]'
            }`}>
              {msg.role === 'ai' && (
                <p className="text-[10px] font-bold text-slate-500 mb-2 uppercase tracking-widest border-b border-[#27272a] pb-2">
                  Tutor NextEducation
                </p>
              )}
              {msg.text}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-[#18181b] p-4 rounded-md border border-[#27272a] text-slate-500 italic text-sm">
              Gerando resposta...
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex gap-3">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
          placeholder="Escreva sua dúvida aqui..."
          className="flex-1 bg-[#18181b] border border-[#27272a] outline-none px-4 py-3 rounded-md text-slate-200 text-sm focus:border-slate-500 transition-colors placeholder:text-slate-600"
        />
        <button
          onClick={sendMessage}
          disabled={loading || !input.trim()}
          className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading ? 'Aguarde...' : 'Enviar'}
        </button>
      </div>
    </div>
  );
}
