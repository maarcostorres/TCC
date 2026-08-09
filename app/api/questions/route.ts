import { NextResponse } from 'next/server';
import { questionsCollection } from '@/lib/db';
import { AREA_ALVO, isAreaSlug, type QuestaoPublica } from '@/lib/enem';

const LIMITE_PADRAO = 10;
const LIMITE_MAXIMO = 45;

function lerLimite(valor: string | null): number {
  const numero = Number.parseInt(valor ?? '', 10);
  if (!Number.isInteger(numero) || numero < 1) return LIMITE_PADRAO;

  return Math.min(numero, LIMITE_MAXIMO);
}

/**
 * Sorteia questões da área de Ciências Humanas.
 *
 * O gabarito (`label`) é omitido da resposta: a correção acontece no servidor,
 * em `POST /api/attempts`. Enviá-lo junto do enunciado deixaria a resposta
 * certa visível no DevTools antes de o aluno responder.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const exam = searchParams.get('year');
    const areaParam = searchParams.get('area');
    const limit = lerLimite(searchParams.get('limit'));

    const area = isAreaSlug(areaParam) ? areaParam : AREA_ALVO;
    const filtro: Record<string, unknown> = { area };
    if (exam && /^\d{4}$/.test(exam)) filtro.exam = exam;

    const collection = await questionsCollection();
    const questions = await collection
      .aggregate<QuestaoPublica>([
        { $match: filtro },
        { $sample: { size: limit } },
        { $project: { label: 0, sourceFile: 0, importedAt: 0 } },
      ])
      .toArray();

    return NextResponse.json({ success: true, count: questions.length, data: questions });
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : 'Erro desconhecido ao buscar questões.';
    console.error('Falha ao buscar questões:', erro);

    return NextResponse.json({ success: false, error: mensagem }, { status: 500 });
  }
}
