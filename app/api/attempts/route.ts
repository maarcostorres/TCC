import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { attemptsCollection, questionsCollection, type Tentativa } from '@/lib/db';
import { isAlternativa, type Alternativa } from '@/lib/enem';
import { getSessao } from '@/lib/session';

type RespostaEnviada = { questionKey: string; resposta: Alternativa };

type Corrigida = {
  questionKey: string;
  resposta: Alternativa;
  gabarito: Alternativa;
  acertou: boolean;
};

function lerRespostas(corpo: unknown): RespostaEnviada[] | null {
  const dados = (corpo ?? {}) as Record<string, unknown>;
  if (!Array.isArray(dados.respostas) || dados.respostas.length === 0) return null;
  if (dados.respostas.length > 50) return null;

  const respostas: RespostaEnviada[] = [];

  for (const item of dados.respostas) {
    const registro = (item ?? {}) as Record<string, unknown>;
    if (typeof registro.questionKey !== 'string' || !isAlternativa(registro.resposta)) return null;

    respostas.push({ questionKey: registro.questionKey, resposta: registro.resposta });
  }

  return respostas;
}

/**
 * Corrige e registra as respostas do estudante.
 *
 * A correção acontece aqui, e não no navegador, porque o gabarito nunca é
 * enviado junto do enunciado — `GET /api/questions` o omite de propósito.
 * Cada tentativa registrada é o que alimenta o dashboard de desempenho.
 */
export async function POST(request: Request) {
  const sessao = await getSessao();
  if (!sessao) {
    return NextResponse.json({ success: false, error: 'Não autenticado.' }, { status: 401 });
  }

  try {
    const corpo = await request.json().catch(() => null);
    const respostas = lerRespostas(corpo);

    if (!respostas) {
      return NextResponse.json(
        { success: false, error: 'Envie uma lista de respostas válida.' },
        { status: 400 },
      );
    }

    const origem = (corpo as Record<string, unknown>)?.origem === 'simulado' ? 'simulado' : 'estudo';
    const sessaoId = origem === 'simulado' ? randomUUID() : null;

    const questions = await questionsCollection();
    const gabaritos = await questions
      .find(
        { questionKey: { $in: respostas.map((r) => r.questionKey) } },
        { projection: { questionKey: 1, label: 1, exam: 1, questionNumber: 1, area: 1 } },
      )
      .toArray();

    const porChave = new Map(gabaritos.map((questao) => [questao.questionKey, questao]));

    const corrigidas: Corrigida[] = [];
    const tentativas: Tentativa[] = [];

    for (const { questionKey, resposta } of respostas) {
      const questao = porChave.get(questionKey);
      if (!questao) continue;

      const acertou = resposta === questao.label;

      corrigidas.push({ questionKey, resposta, gabarito: questao.label, acertou });
      tentativas.push({
        userId: sessao.sub,
        questionKey,
        exam: questao.exam,
        questionNumber: questao.questionNumber,
        area: questao.area,
        origem,
        sessaoId,
        resposta,
        gabarito: questao.label,
        acertou,
        latenciaIaMs: null,
        feedbackSimulado: false,
        respondidoEm: new Date(),
      });
    }

    if (tentativas.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Nenhuma das questões enviadas foi encontrada.' },
        { status: 404 },
      );
    }

    await (await attemptsCollection()).insertMany(tentativas);

    return NextResponse.json({
      success: true,
      sessaoId,
      acertos: corrigidas.filter((item) => item.acertou).length,
      total: corrigidas.length,
      correcoes: corrigidas,
    });
  } catch (erro) {
    console.error('Falha ao registrar tentativa:', erro);

    return NextResponse.json(
      { success: false, error: 'Não foi possível registrar sua resposta.' },
      { status: 500 },
    );
  }
}
