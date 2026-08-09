import { NextResponse } from 'next/server';
import { attemptsCollection, questionsCollection } from '@/lib/db';
import { isAlternativa } from '@/lib/enem';
import { getPedagogicalFeedback } from '@/lib/groq';
import { getSessao } from '@/lib/session';

/**
 * Gera a explicação didática de uma questão já respondida.
 *
 * Fica separada de `POST /api/attempts` de propósito: a correção precisa ser
 * instantânea, enquanto a explicação depende de uma chamada ao modelo. A tela
 * mostra o acerto ou erro na hora e carrega o texto do tutor em seguida.
 *
 * A latência medida é gravada na tentativa correspondente, o que torna o
 * requisito de baixa latência verificável no dashboard.
 */
export const maxDuration = 30;

export async function POST(request: Request) {
  const sessao = await getSessao();
  if (!sessao) {
    return NextResponse.json({ success: false, error: 'Não autenticado.' }, { status: 401 });
  }

  try {
    const corpo = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    const questionKey = corpo?.questionKey;
    const resposta = corpo?.resposta;

    if (typeof questionKey !== 'string' || !isAlternativa(resposta)) {
      return NextResponse.json(
        { success: false, error: 'Informe a questão e a alternativa escolhida.' },
        { status: 400 },
      );
    }

    const questao = await (await questionsCollection()).findOne({ questionKey });
    if (!questao) {
      return NextResponse.json({ success: false, error: 'Questão não encontrada.' }, { status: 404 });
    }

    const feedback = await getPedagogicalFeedback(questao, resposta);

    // Anexa a medição à tentativa mais recente desta questão para este aluno.
    // `findOneAndUpdate` é usado no lugar de `updateOne` porque só ele aceita
    // `sort` em todas as versões do servidor suportadas pelo driver.
    await (await attemptsCollection()).findOneAndUpdate(
      { userId: sessao.sub, questionKey },
      { $set: { latenciaIaMs: feedback.latenciaMs, feedbackSimulado: feedback.isMock } },
      { sort: { respondidoEm: -1 } },
    );

    return NextResponse.json({
      success: true,
      feedback: feedback.message,
      gabarito: questao.label,
      acertou: resposta === questao.label,
      latenciaMs: feedback.latenciaMs,
      modelo: feedback.modelo,
      isMock: feedback.isMock,
    });
  } catch (erro) {
    console.error('Falha ao gerar feedback:', erro);

    return NextResponse.json(
      { success: false, error: 'Não foi possível gerar a explicação agora.' },
      { status: 500 },
    );
  }
}
