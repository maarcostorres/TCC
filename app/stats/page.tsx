'use client';

import React from 'react';

export default function StatsPage() {
  const stats = [
    { label: 'Total Indexado Resolvido', value: '142', growth: '+12%', status: 'positive' },
    { label: 'Taxa de Proficiência Base', value: '78%', growth: '+5%', status: 'positive' },
    { label: 'Tempo Otimizado p/ Item', value: '01:45', growth: '-10s', status: 'positive' },
    { label: 'Baterias Concluídas', value: '12', growth: '+2', status: 'neutral' },
  ];

  return (
    <div className="space-y-8">
      <div className="mb-8 border-b border-[#27272a] pb-6">
         <h1 className="text-xl font-semibold text-white tracking-tight">Performance e Telemetria</h1>
         <p className="text-sm text-slate-500 mt-1">
           Métricas agregadas do perfil de estudante na plataforma NextEducation.
         </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {stats.map((item, i) => (
          <div key={i} className="card-solid p-6 flex flex-col justify-between">
             <div className="flex justify-between items-start mb-4">
                 <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest leading-tight w-2/3">{item.label}</p>
                 <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-sm ${
                   item.status === 'positive' ? 'bg-green-500/10 text-green-400' : 'bg-slate-800 text-slate-300'
                 }`}>
                   {item.growth}
                 </span>
             </div>
             <p className="text-3xl font-semibold text-white tracking-tight">{item.value}</p>
          </div>
        ))}
      </div>

      {/* Gráfico Placeholder B2B */}
      <div className="card-solid p-8 h-80 flex flex-col items-center justify-center text-center space-y-4">
          <div className="w-16 h-8 flex items-end justify-center gap-1 opacity-40">
             <div className="w-2 h-4 bg-slate-500 rounded-sm"></div>
             <div className="w-2 h-6 bg-slate-500 rounded-sm"></div>
             <div className="w-2 h-3 bg-slate-500 rounded-sm"></div>
             <div className="w-2 h-8 bg-slate-300 rounded-sm"></div>
          </div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mt-4">Módulo Gráfico Desativado</p>
          <p className="text-sm text-slate-500 max-w-sm">A integração visual de telemetria baseada nas competências do ENEM será carregada no próximo deploy.</p>
      </div>
    </div>
  );
}
