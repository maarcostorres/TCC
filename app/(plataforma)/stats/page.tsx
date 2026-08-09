'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import GraficoEvolucao from '@/components/GraficoEvolucao';
import type { Estatisticas } from '@/app/api/stats/route';

export default function DesempenhoPage() {
  const [dados, setDados] = useState<Estatisticas | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;

    (async () => {
      try {
        const resposta = await fetch('/api/stats');
        const corpo = await resposta.json();
        if (!ativo) return;

        if (corpo.success) {
          setDados(corpo.estatisticas);
        } else {
          setErro(corpo.error ?? 'Não foi possível carregar seu desempenho.');
        }
      } catch {
        if (ativo) setErro('Falha de conexão ao carregar seu desempenho.');
      } finally {
        if (ativo) setCarregando(false);
      }
    })();

    return () => {
      ativo = false;
    };
  }, []);

  const cabecalho = (
    <div className="mb-8 border-b border-[#27272a] pb-6">
      <h1 className="text-xl font-semibold text-white tracking-tight">Meu desempenho</h1>
      <p className="text-sm text-slate-500 mt-1">
        Métricas calculadas sobre as questões que você respondeu na plataforma.
      </p>
    </div>
  );

  if (carregando) {
    return (
      <div className="space-y-8">
        {cabecalho}
        <p className="text-sm text-slate-500">Carregando seus dados...</p>
      </div>
    );
  }

  if (erro || !dados) {
    return (
      <div className="space-y-8">
        {cabecalho}
        <p role="alert" className="text-sm text-red-400">
          {erro}
        </p>
      </div>
    );
  }

  if (dados.totalRespondidas === 0) {
    return (
      <div className="space-y-8">
        {cabecalho}
        <div className="card-solid p-10 text-center space-y-4">
          <p className="text-sm text-slate-400 max-w-md mx-auto leading-relaxed">
            Você ainda não respondeu nenhuma questão. Assim que começar a estudar, seu
            aproveitamento e sua evolução aparecem aqui.
          </p>
          <Link href="/estudo" className="btn-primary">
            Estudar questões
          </Link>
        </div>
      </div>
    );
  }

  const cartoes = [
    {
      rotulo: 'Questões respondidas',
      valor: dados.totalRespondidas.toString(),
      detalhe: `${dados.acertos} ${dados.acertos === 1 ? 'acerto' : 'acertos'}`,
    },
    {
      rotulo: 'Aproveitamento',
      valor: dados.taxaAcerto === null ? '—' : `${dados.taxaAcerto}%`,
      detalhe: 'Sobre todas as respostas',
    },
    {
      rotulo: 'Mini provas concluídas',
      valor: dados.simuladosConcluidos.toString(),
      detalhe: 'Com tempo cronometrado',
    },
    {
      rotulo: 'Cobertura do banco',
      valor: dados.cobertura === null ? '—' : `${dados.cobertura}%`,
      detalhe: `de ${dados.questoesDisponiveis} questões disponíveis`,
    },
  ];

  return (
    <div className="space-y-8">
      {cabecalho}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {cartoes.map((cartao) => (
          <div key={cartao.rotulo} className="card-solid p-6 flex flex-col justify-between gap-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest leading-tight">
              {cartao.rotulo}
            </p>
            <div>
              <p className="text-3xl font-semibold text-white tracking-tight">{cartao.valor}</p>
              <p className="text-xs text-slate-500 mt-1">{cartao.detalhe}</p>
            </div>
          </div>
        ))}
      </div>

      <GraficoEvolucao sessoes={dados.ultimasSessoes} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section className="card-solid p-6">
          <h2 className="text-sm font-semibold text-slate-200 mb-1">Aproveitamento por edição</h2>
          <p className="text-xs text-slate-500 mb-5">
            Como você se sai em cada ano de prova do ENEM.
          </p>

          <table className="w-full text-sm">
            <caption className="sr-only">Acertos por edição do ENEM</caption>
            <thead>
              <tr className="text-left text-xs uppercase tracking-widest text-slate-500">
                <th scope="col" className="pb-3 font-semibold">
                  Edição
                </th>
                <th scope="col" className="pb-3 font-semibold text-right">
                  Respondidas
                </th>
                <th scope="col" className="pb-3 font-semibold text-right">
                  Acerto
                </th>
              </tr>
            </thead>
            <tbody className="text-slate-300">
              {dados.porEdicao.map((linha) => (
                <tr key={linha.exam} className="border-t border-[#27272a]">
                  <th scope="row" className="py-3 font-medium text-left">
                    ENEM {linha.exam}
                  </th>
                  <td className="py-3 text-right tabular-nums">{linha.total}</td>
                  <td className="py-3 text-right tabular-nums font-semibold text-white">
                    {linha.taxaAcerto}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="card-solid p-6">
          <h2 className="text-sm font-semibold text-slate-200 mb-1">Tempo de resposta do tutor</h2>
          <p className="text-xs text-slate-500 mb-5">
            Latência medida nas chamadas ao modelo Llama 3.3 pela API Groq durante seus estudos.
          </p>

          {dados.latenciaMediaMs === null ? (
            <p className="text-sm text-slate-500">
              Nenhuma explicação foi gerada ainda — responda uma questão para medir.
            </p>
          ) : (
            <dl className="grid grid-cols-2 gap-4">
              <div>
                <dt className="text-xs uppercase tracking-widest text-slate-500 mb-1">Média</dt>
                <dd className="text-2xl font-semibold text-white tabular-nums">
                  {(dados.latenciaMediaMs / 1000).toFixed(2)}s
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-widest text-slate-500 mb-1">
                  Percentil 95
                </dt>
                <dd className="text-2xl font-semibold text-white tabular-nums">
                  {((dados.latenciaP95Ms ?? 0) / 1000).toFixed(2)}s
                </dd>
              </div>
            </dl>
          )}
        </section>
      </div>
    </div>
  );
}
