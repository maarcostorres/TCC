'use client';

import React, { useState, useEffect } from 'react';

type Question = {
  id: string;
  exam: string;
  question: string;
  alternatives: string[];
  label: string;
};

export default function SimuladoPage() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Record<string, string>>({});
  const [timeLeft, setTimeLeft] = useState(600); 
  const [examStarted, setExamStarted] = useState(false);
  const [examEnded, setExamEnded] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (examStarted && timeLeft > 0 && !examEnded) {
      timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
    } else if (timeLeft === 0) {
      setExamEnded(true);
    }
    return () => clearTimeout(timer);
  }, [examStarted, timeLeft, examEnded]);

  const startExam = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/questions?limit=5'); 
      const data = await res.json();
      if (data.success) {
        setQuestions(data.data);
        setExamStarted(true);
        setTimeLeft(300); 
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (letter: string) => {
    const q = questions[currentIndex];
    setUserAnswers({ ...userAnswers, [q.id]: letter });
  };

  const calculateScore = () => {
    let correct = 0;
    questions.forEach(q => {
      if (userAnswers[q.id] === q.label) correct++;
    });
    return correct;
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!examStarted) {
    return (
      <div className="flex flex-col max-w-2xl mx-auto items-start mt-20 fade-in">
        <h1 className="text-3xl font-semibold text-white tracking-tight mb-2">Ambiente de Simulado Submetido a Pressão</h1>
        <p className="text-sm text-slate-400 mb-8 leading-relaxed">
          Este ambiente requer fone de ouvido para isolamento ou local reservado. O protocolo bloqueia distrações com timer rigoroso. Inicie quando estiver preparado.
        </p>

        <div className="grid grid-cols-2 gap-4 w-full mb-8">
           <div className="card-solid p-5">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 mb-1">Carga de Teste</p>
              <p className="text-lg font-semibold text-white">5 Questões</p>
           </div>
           <div className="card-solid p-5">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 mb-1">Tempo Alocado</p>
              <p className="text-lg font-semibold text-white">05m : 00s</p>
           </div>
        </div>

        <button onClick={startExam} disabled={loading} className="btn-primary">
           {loading ? 'Compilando Documento...' : 'Aceitar Termos e Iniciar Simulado'}
        </button>
      </div>
    );
  }

  if (examEnded) {
    const score = calculateScore();
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center fade-in">
        <div className="mb-8">
           <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">Auditoria de Simulado Finalizada</p>
           <h1 className="text-2xl font-semibold text-white">Reporte de Eficiência</h1>
        </div>
        
        <div className="flex gap-4 mb-8">
           <div className="card-solid p-8 text-center min-w-[200px]">
              <p className="text-xs text-slate-400 uppercase font-semibold tracking-widest mb-2">Taxa de Acerto</p>
              <p className="text-4xl font-semibold text-white">{score} <span className="text-lg text-slate-600">/ {questions.length}</span></p>
           </div>
           <div className="card-solid p-8 text-center min-w-[200px]">
              <p className="text-xs text-slate-400 uppercase font-semibold tracking-widest mb-2">Tempo Executado</p>
              <p className="text-4xl font-semibold text-white tracking-tight">{formatTime(300 - timeLeft)}</p>
           </div>
        </div>

        <button onClick={() => window.location.reload()} className="btn-secondary">
           Retornar ao Dashboard
        </button>
      </div>
    );
  }

  const q = questions[currentIndex];
  return (
    <div className="max-w-3xl mx-auto pb-32">
      {/* Header Foco Total */}
      <div className="flex justify-between items-center mb-8 border-b border-[#27272a] pb-6 sticky top-0 bg-[#09090b] z-10 pt-4">
        <div>
           <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Protocolo de Simulado • Exame {q.exam}</span>
           <p className="text-sm font-semibold text-white mt-1">Item {currentIndex + 1} de {questions.length}</p>
        </div>
        
        <div className={`px-4 py-1.5 rounded-sm font-mono text-sm font-semibold transition-colors border ${
          timeLeft < 60 
          ? 'bg-red-900/20 text-red-400 border-red-900/50' 
          : 'bg-[#18181b] text-slate-300 border-[#27272a]'
        }`}>
          {formatTime(timeLeft)} Restantes
        </div>
      </div>

      <div className="card-solid p-8 mb-8 text-sm leading-relaxed text-slate-200">
        {q.question.replace(/\[\[.*?\]\]/g, '')}
      </div>

      <div className="space-y-3 mb-10">
        {q.alternatives.map((alt, idx) => {
          const letter = ['A', 'B', 'C', 'D', 'E'][idx];
          const isSelected = userAnswers[q.id] === letter;

          return (
            <button
              key={idx}
              onClick={() => handleSelect(letter)}
              className={`w-full text-left p-4 rounded-md border transition-colors flex items-start gap-4 ${
                isSelected 
                ? 'border-white bg-[#18181b] text-white' 
                : 'border-[#27272a] bg-[#18181b] text-slate-400 hover:border-slate-500'
              }`}
            >
              <div className={`mt-0.5 w-6 h-6 shrink-0 rounded-sm flex items-center justify-center text-[10px] font-bold border ${
                isSelected ? 'border-transparent bg-white text-black' : 'border-[#27272a] text-slate-500'
              }`}>
                {letter}
              </div>
              <span className="text-sm flex-1 leading-relaxed">{alt}</span>
            </button>
          );
        })}
      </div>

      <div className="pt-6 border-t border-[#27272a] flex justify-between">
          <button 
            disabled={currentIndex === 0} 
            onClick={() => setCurrentIndex(currentIndex - 1)}
            className="btn-secondary disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Item Anterior
          </button>
          
          {currentIndex < questions.length - 1 ? (
            <button 
              onClick={() => setCurrentIndex(currentIndex + 1)} 
              className="btn-primary"
            >
              Próximo Item
            </button>
          ) : (
            <button 
               onClick={() => setExamEnded(true)} 
               className="btn-primary !bg-white !text-black"
            >
              Submeter Simulado Completo
            </button>
          )}
      </div>
    </div>
  );
}
