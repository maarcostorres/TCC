import { NextResponse } from 'next/server';
import { attemptsCollection, questionsCollection } from '@/lib/db';
import { AREA_ALVO } from '@/lib/enem';
import { getSessao } from '@/lib/session';

export type Estatisticas = {
  totalRespondidas: number;
  acertos: number;
  taxaAcerto: number | null;
  questoesDisponiveis: number;
  cobertura: number | null;
  simuladosConcluidos: number;
  latenciaMediaMs: number | null;
  latenciaP95Ms: number | null;
  porEdicao: { exam: string; total: number; acertos: number; taxaAcerto: number }[];
  ultimasSessoes: { data: string; total: number; acertos: number; taxaAcerto: number }[];
};

function percentil(valores: number[], p: number): number | null {
  if (valores.length === 0) return null;

  const ordenados = [...valores].sort((a, b) => a - b);
  const indice = Math.min(ordenados.length - 1, Math.ceil((p / 100) * ordenados.length) - 1);

  return ordenados[Math.max(0, indice)];
}

/** Métricas de desempenho do estudante autenticado, calculadas sobre as
 *  tentativas realmente registradas no MongoDB. */
export async function GET() {
  const sessao = await getSessao();
  if (!sessao) {
    return NextResponse.json({ success: false, error: 'Não autenticado.' }, { status: 401 });
  }

  try {
    const attempts = await attemptsCollection();
    const questions = await questionsCollection();

    const [tentativas, questoesDisponiveis] = await Promise.all([
      attempts.find({ userId: sessao.sub }).sort({ respondidoEm: 1 }).toArray(),
      questions.countDocuments({ area: AREA_ALVO }),
    ]);

    const totalRespondidas = tentativas.length;
    const acertos = tentativas.filter((t) => t.acertou).length;

    const latencias = tentativas
      .map((t) => t.latenciaIaMs)
      .filter((valor): valor is number => typeof valor === 'number' && valor > 0);

    // Agrupamento por edição do exame.
    const porEdicaoMapa = new Map<string, { total: number; acertos: number }>();
    for (const tentativa of tentativas) {
      const atual = porEdicaoMapa.get(tentativa.exam) ?? { total: 0, acertos: 0 };
      atual.total += 1;
      if (tentativa.acertou) atual.acertos += 1;
      porEdicaoMapa.set(tentativa.exam, atual);
    }

    const porEdicao = [...porEdicaoMapa.entries()]
      .map(([exam, dados]) => ({
        exam,
        ...dados,
        taxaAcerto: Math.round((dados.acertos / dados.total) * 100),
      }))
      .sort((a, b) => a.exam.localeCompare(b.exam));

    // Evolução por dia de estudo — base do gráfico do dashboard.
    const porDiaMapa = new Map<string, { total: number; acertos: number }>();
    for (const tentativa of tentativas) {
      const dia = tentativa.respondidoEm.toISOString().slice(0, 10);
      const atual = porDiaMapa.get(dia) ?? { total: 0, acertos: 0 };
      atual.total += 1;
      if (tentativa.acertou) atual.acertos += 1;
      porDiaMapa.set(dia, atual);
    }

    const ultimasSessoes = [...porDiaMapa.entries()]
      .map(([data, dados]) => ({
        data,
        ...dados,
        taxaAcerto: Math.round((dados.acertos / dados.total) * 100),
      }))
      .sort((a, b) => a.data.localeCompare(b.data))
      .slice(-14);

    const simulados = new Set(
      tentativas.filter((t) => t.sessaoId !== null).map((t) => t.sessaoId),
    );

    const estatisticas: Estatisticas = {
      totalRespondidas,
      acertos,
      taxaAcerto: totalRespondidas > 0 ? Math.round((acertos / totalRespondidas) * 100) : null,
      questoesDisponiveis,
      cobertura:
        questoesDisponiveis > 0
          ? Math.round(
              (new Set(tentativas.map((t) => t.questionKey)).size / questoesDisponiveis) * 100,
            )
          : null,
      simuladosConcluidos: simulados.size,
      latenciaMediaMs:
        latencias.length > 0
          ? Math.round(latencias.reduce((soma, valor) => soma + valor, 0) / latencias.length)
          : null,
      latenciaP95Ms: percentil(latencias, 95),
      porEdicao,
      ultimasSessoes,
    };

    return NextResponse.json({ success: true, estatisticas });
  } catch (erro) {
    console.error('Falha ao calcular estatísticas:', erro);

    return NextResponse.json(
      { success: false, error: 'Não foi possível carregar seu desempenho.' },
      { status: 500 },
    );
  }
}
