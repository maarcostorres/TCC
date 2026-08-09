import { NextResponse } from 'next/server';
import { getTutorResponse } from '@/lib/groq';
import { getSessao } from '@/lib/session';

const TAMANHO_MAXIMO = 2_000;

/**
 * Teto de execução da função, em segundos. A resposta do modelo leva segundos,
 * não dezenas deles: o limite existe para cortar uma chamada pendurada em vez
 * de deixar o aluno esperando pelo tempo máximo da plataforma.
 */
export const maxDuration = 30;

export async function POST(request: Request) {
  const sessao = await getSessao();
  if (!sessao) {
    return NextResponse.json({ success: false, error: 'Não autenticado.' }, { status: 401 });
  }

  try {
    const corpo = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    const mensagem = typeof corpo?.message === 'string' ? corpo.message.trim() : '';

    if (!mensagem) {
      return NextResponse.json(
        { success: false, error: 'Escreva sua dúvida antes de enviar.' },
        { status: 400 },
      );
    }

    if (mensagem.length > TAMANHO_MAXIMO) {
      return NextResponse.json(
        { success: false, error: `Sua pergunta passou de ${TAMANHO_MAXIMO} caracteres.` },
        { status: 400 },
      );
    }

    const resultado = await getTutorResponse(mensagem);

    return NextResponse.json({
      success: true,
      message: resultado.message,
      latenciaMs: resultado.latenciaMs,
      isMock: resultado.isMock,
    });
  } catch (erro) {
    console.error('Falha no Tutor IA:', erro);

    return NextResponse.json(
      { success: false, error: 'Não foi possível responder agora.' },
      { status: 500 },
    );
  }
}
