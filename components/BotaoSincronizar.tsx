'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Estado = 'ocioso' | 'sincronizando' | 'concluido' | 'erro';

export default function BotaoSincronizar() {
  const router = useRouter();
  const [estado, setEstado] = useState<Estado>('ocioso');
  const [mensagem, setMensagem] = useState('');

  async function sincronizar() {
    setEstado('sincronizando');
    setMensagem('');

    try {
      const resposta = await fetch('/api/questions/seed', { method: 'POST' });
      const corpo = await resposta.json();

      if (corpo.success) {
        setEstado('concluido');
        setMensagem(`${corpo.totalProcessed} questões sincronizadas.`);
        // Atualiza os contadores do painel, que são renderizados no servidor.
        router.refresh();
      } else {
        setEstado('erro');
        setMensagem(corpo.error ?? 'Falha na sincronização.');
      }
    } catch {
      setEstado('erro');
      setMensagem('Não foi possível falar com o servidor.');
    }
  }

  return (
    <div className="card-solid p-6 flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
      <div className="space-y-1 max-w-md">
        <h2 className="text-sm font-semibold tracking-tight text-slate-200">
          Sincronizar banco de questões
        </h2>
        <p className="text-xs text-slate-500 leading-relaxed">
          Importa as questões de Ciências Humanas dos cadernos de 2022 a 2024 do dataset
          ENEM-Benchmark para o MongoDB. Pode ser executado novamente sem duplicar registros.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-3 shrink-0">
        <p
          aria-live="polite"
          className={`text-xs font-medium ${estado === 'erro' ? 'text-red-400' : 'text-green-400'}`}
        >
          {mensagem}
        </p>

        <button
          type="button"
          onClick={sincronizar}
          disabled={estado === 'sincronizando'}
          className="btn-secondary text-xs bg-[#09090b]"
        >
          {estado === 'sincronizando' ? 'Sincronizando...' : 'Sincronizar agora'}
        </button>
      </div>
    </div>
  );
}
