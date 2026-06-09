'use client';

import React, { useState, useEffect } from 'react';

type Question = {
  id: string;
  exam: string;
  question: string;
  alternatives: string[];
  label: string;
  figures: string[];
  description: string[];
};

export default function StudyPage() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [loading, setLoading] = useState(true);
  const [aiFeedback, setAiFeedback] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    fetchQuestions();
  }, []);

  const fetchQuestions = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/questions?limit=20');
      const data = await res.json();
      if (data.success) {
        setQuestions(data.data);
      }
    } catch (err) {
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (letter: string) => {
    if (showFeedback) return;
    setSelectedAnswer(letter);
  };

  const checkAnswer = async () => {
    if (!selectedAnswer) return;
    setShowFeedback(true);
    setAiLoading(true);
    
    try {
      const res = await fetch('/api/ai/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: questions[currentIndex],
          userChoice: selectedAnswer
        })
      });
      const data = await res.json();
      if (data.success) {
        setAiFeedback(data.feedback);
      }
    } catch (err) {
      console.error('AI error:', err);
      setAiFeedback("Erro de camada de rede. Serviço LLM inacessível no momento.");
    } finally {
      setAiLoading(false);
    }
  };

  const nextQuestion = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setSelectedAnswer(null);
      setShowFeedback(false);
      setAiFeedback(null);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[70vh] border border-[#27272a] rounded-md bg-[#18181b]">
        <p className="text-sm font-semibold tracking-widest text-slate-400 uppercase">Consultando Motor de Dados...</p>
      </div>
    );
  }

  const q = questions[currentIndex];
  if (!q) return <div className="text-center p-12 border border-[#27272a] text-slate-400">Dataset de questões não indexado no cluster.</div>;

  const alphabet = ['A', 'B', 'C', 'D', 'E'];

  return (
    <div className="max-w-3xl mx-auto pb-32">
      {/* Header Analítico */}
      <div className="flex justify-between items-center mb-8 border-b border-[#27272a] pb-6">
        <div>
          <h1 className="text-xl font-semibold text-white tracking-tight">Análise de Domínio - Questão {currentIndex + 1}</h1>
          <p className="text-xs text-slate-500 mt-1 uppercase tracking-widest font-semibold">Matriz Enem {q.exam} • Ciências Humanas</p>
        </div>
        <div className="text-sm font-semibold text-slate-400">
           Volume Ativo: {currentIndex + 1} / {questions.length}
        </div>
      </div>

      {/* Caixa de Texto do Enunciado */}
      <div className="card-solid p-10 mb-8 bg-[#09090b]">
        <div className="leading-relaxed text-sm text-slate-200">
          {q.question.replace(/\[\[.*?\]\]/g, '').split('\n').map((paragraph, i) => (
             <p key={i} className="mb-4 last:mb-0">{paragraph}</p>
          ))}
        </div>
        
        {q.figures.length > 0 && (
          <div className="mt-8 p-4 border border-[#27272a] bg-[#18181b] rounded-sm">
             <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 mb-2">Nota Suplementar de MídiaVisual</p>
             <p className="text-xs text-slate-400 italic">Evidência textual gráfica: "{q.description[0]}"</p>
          </div>
        )}
      </div>

      {/* Alternativas */}
      <div className="space-y-3 mb-10">
        {q.alternatives.map((alt, idx) => {
          const letter = alphabet[idx];
          const isSelected = selectedAnswer === letter;
          const isCorrect = letter === q.label;
          
          let stateStyle = "border-[#27272a] bg-[#18181b] text-slate-300 hover:border-slate-600";
          
          if (isSelected) stateStyle = "border-blue-600 bg-[#09090b] text-white";
          if (showFeedback && isCorrect) stateStyle = "border-green-600 bg-[#09090b] text-white";
          if (showFeedback && isSelected && !isCorrect) stateStyle = "border-red-800 bg-[#09090b] text-slate-400 opacity-60";

          return (
            <button
              key={letter}
              onClick={() => handleSelect(letter)}
              className={`w-full text-left p-4 rounded-md border transition-colors flex items-start gap-4 ${stateStyle}`}
            >
              <div className={`mt-0.5 w-6 h-6 shrink-0 rounded flex items-center justify-center text-xs font-semibold border ${
                isSelected || (showFeedback && isCorrect) ? 'border-transparent bg-white text-black' : 'border-[#27272a] text-slate-500'
              }`}>
                {letter}
              </div>
              <span className="flex-1 text-sm leading-relaxed">{alt}</span>
            </button>
          );
        })}
      </div>

      {/* Seção de Controle e IA */}
      <div className="pt-6 border-t border-[#27272a]">
          {!showFeedback ? (
            <button
              onClick={checkAnswer}
              disabled={!selectedAnswer}
              className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Submeter Resposta
            </button>
          ) : (
            <div className="space-y-4 fade-in">
              {/* Feedback Documental */}
              <div className="border border-[#27272a] rounded-md bg-[#18181b] p-6">
                 <div className="flex justify-between items-center mb-6">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">
                       Relatório Diagnóstico IA
                    </p>
                    <span className="text-[10px] bg-blue-900/30 text-blue-400 px-2 py-1 rounded border border-blue-900/50">
                       Generative AI Model
                    </span>
                 </div>
                 
                 <h3 className={`text-base font-semibold mb-4 ${selectedAnswer === q.label ? 'text-green-500' : 'text-red-400'}`}>
                   Status de Validação: {selectedAnswer === q.label ? 'Adequado (Acerto)' : 'Inadequado (Conceito Falho)'} 
                 </h3>
                 
                 {aiLoading ? (
                   <p className="text-sm text-slate-500 italic">Processando insights pedagógicos...</p>
                 ) : (
                   <div className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
                      {aiFeedback}
                   </div>
                 )}
              </div>

              <div className="flex justify-end">
                <button onClick={nextQuestion} className="btn-secondary text-sm">
                   Avançar Para Próximo Tópico
                </button>
              </div>
            </div>
          )}
      </div>
    </div>
  );
}
