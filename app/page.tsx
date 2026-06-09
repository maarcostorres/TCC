'use client';

import React, { useState } from 'react';
import Link from 'next/link';

export default function Home() {
  const [syncStatus, setSyncStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const syncDatabase = async () => {
    setSyncStatus('loading');
    try {
      const res = await fetch('/api/questions/seed');
      const data = await res.json();
      if (data.success) {
        setSyncStatus('success');
        setMessage(`${data.totalProcessed} records indexed successfully.`);
      } else {
        setSyncStatus('error');
        setMessage(data.error);
      }
    } catch (err) {
      setSyncStatus('error');
      setMessage('Network layer error. Server unreachable.');
    }
  };

  return (
    <div className="space-y-8">
      {/* Infrastructure Alert */}
      <div className="flex items-center gap-3 px-4 py-3 bg-[#18181b] border border-[#27272a] rounded-md text-sm text-slate-300">
         <span className="w-2 h-2 rounded-full bg-green-500"></span>
         <span className="font-semibold">NextEducation Core Engine</span> is online and routing traffic manually.
      </div>

      {/* Hero Header */}
      <section className="mb-12">
          <h1 className="text-4xl font-semibold text-white tracking-tight mb-4">
            Painel Geral do Aluno
          </h1>
          <p className="text-slate-400 max-w-2xl leading-relaxed text-sm">
            Bem-vindo à NextEducation. Explore uma arquitetura pedagógica orientada a dados, desenhada para otimização de performance no ENEM (Ciências Humanas). Modelos LLM operacionais e sincronizados.
          </p>

          <div className="flex gap-4 mt-8">
             <Link href="/estudo" className="btn-primary">
               Iniciar Módulo de Estudos
             </Link>
             <Link href="/simulado" className="btn-secondary">
               Bateria de Simulados
             </Link>
          </div>
      </section>

      {/* Analytics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
         {[
           { label: 'Volume Indexado (Dataset Oficial)', value: '540', detail: 'Ciclo 2022-2024' },
           { label: 'Parâmetro de Tempo Sugerido', value: '45min', detail: 'Tolerância Simulado' },
           { label: 'Baseline de Proficiência', value: '--%', detail: 'Aguardando inputs' },
         ].map((stat, i) => (
           <div key={i} className="card-solid p-6 flex flex-col justify-between h-36">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">{stat.label}</p>
              <div>
                 <p className="text-3xl font-semibold text-white">{stat.value}</p>
                 <p className="text-xs text-slate-400 mt-1">{stat.detail}</p>
              </div>
           </div>
         ))}
      </div>

      {/* Sincronização Server-Side */}
      <div className="mt-8 card-solid p-6 flex items-center justify-between">
         <div className="space-y-1 max-w-md">
            <h3 className="text-sm font-semibold tracking-tight text-slate-200">Sincronização de Instância (Data Warehouse)</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Consolide os nós lógicos do dataset JSONL local para o Cluster MongoDB remoto visando atualização em tempo real do banco de estudos.
            </p>
         </div>
         
         <div className="flex items-center gap-4">
            {syncStatus === 'success' && <p className="text-xs text-green-400 font-medium">{message}</p>}
            {syncStatus === 'error' && <p className="text-xs text-red-400 font-medium">{message}</p>}
            
            <button 
               onClick={syncDatabase}
               disabled={syncStatus === 'loading'}
               className="btn-secondary text-xs bg-[#09090b]"
            >
               {syncStatus === 'loading' ? 'Indexando...' : 'Forçar Sync Pipeline'}
            </button>
         </div>
      </div>
    </div>
  );
}
