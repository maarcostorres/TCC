import { NextResponse } from 'next/server';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { questionsCollection } from '@/lib/db';
import { AREA_LABELS, AREA_ALVO, curarQuestao, type QuestaoCurada } from '@/lib/enem';
import { getSessao } from '@/lib/session';

const ARQUIVOS = ['2022.jsonl', '2023.jsonl', '2024.jsonl'];

type ResumoEdicao = {
  arquivo: string;
  linhas: number;
  importadas: number;
  descartadas: number;
};

/**
 * Carrega o dataset ENEM-Benchmark no MongoDB, mantendo apenas as questões de
 * Ciências Humanas (posições 046-090 de cada caderno).
 *
 * O upsert usa `questionKey` (`"2023-046"`) e não o campo `id` do dataset: os
 * três arquivos numeram suas questões de `questao_01` a `questao_180`, então
 * uma chave baseada só em `id` faria cada edição sobrescrever a anterior.
 */
export async function POST() {
  // Reimportar as três edições é caro, e a rota fica exposta na internet
  // depois do deploy. O `proxy.ts` sozinho não basta: ele responde com um
  // redirecionamento, que não é resposta adequada a um POST.
  const sessao = await getSessao();
  if (!sessao) {
    return NextResponse.json({ success: false, error: 'Não autenticado.' }, { status: 401 });
  }

  try {
    const collection = await questionsCollection();
    const dataDir = path.join(process.cwd(), 'data');

    // Remove os documentos gravados pela versão anterior do seed, que não
    // tinham `questionKey`. Além de serem inalcançáveis pelas consultas (todas
    // filtram por `area`), eles impediam a criação do índice único, já que
    // vários compartilhavam a chave nula.
    const legado = await collection.deleteMany({ questionKey: { $exists: false } });

    const resumo: ResumoEdicao[] = [];
    const motivosDescarte = new Map<string, number>();
    let totalProcessed = 0;

    for (const arquivo of ARQUIVOS) {
      const caminho = path.join(dataDir, arquivo);

      let conteudo: string;
      try {
        conteudo = await fs.readFile(caminho, 'utf8');
      } catch (erro) {
        // Sem o motivo, um arquivo ausente vira "0 questões sincronizadas" — o
        // mesmo resultado de um dataset vazio. Registrá-lo distingue os dois
        // casos, o que importa em produção: é assim que se descobre que o
        // dataset não chegou ao pacote da função.
        const motivo = `${arquivo} não pôde ser lido: ${erro instanceof Error ? erro.message : String(erro)}`;
        motivosDescarte.set(motivo, (motivosDescarte.get(motivo) ?? 0) + 1);
        resumo.push({ arquivo, linhas: 0, importadas: 0, descartadas: 0 });
        continue;
      }

      const linhas = conteudo.split('\n').filter((linha) => linha.trim() !== '');
      const questoes: QuestaoCurada[] = [];

      for (const linha of linhas) {
        let bruta: unknown;
        try {
          bruta = JSON.parse(linha);
        } catch {
          motivosDescarte.set('JSON inválido', (motivosDescarte.get('JSON inválido') ?? 0) + 1);
          continue;
        }

        const resultado = curarQuestao(bruta as Record<string, unknown>, arquivo);
        if (resultado.ok) {
          questoes.push(resultado.questao);
        } else {
          motivosDescarte.set(resultado.motivo, (motivosDescarte.get(resultado.motivo) ?? 0) + 1);
        }
      }

      if (questoes.length > 0) {
        // bulkWrite substitui os 540 updateOne sequenciais do seed anterior:
        // uma ida ao cluster por edição em vez de uma por questão.
        await collection.bulkWrite(
          questoes.map((questao) => ({
            updateOne: {
              filter: { questionKey: questao.questionKey },
              update: { $set: questao },
              upsert: true,
            },
          })),
          { ordered: false },
        );
      }

      resumo.push({
        arquivo,
        linhas: linhas.length,
        importadas: questoes.length,
        descartadas: linhas.length - questoes.length,
      });
      totalProcessed += questoes.length;
    }

    // Agora que não há mais chaves nulas, o índice único pode ser criado. Fica
    // aqui, e não só em `getDb`, para que uma base que já rodou a versão antiga
    // se conserte na primeira sincronização.
    await collection.createIndex({ questionKey: 1 }, { unique: true });

    const totalNoBanco = await collection.countDocuments({ area: AREA_ALVO });

    return NextResponse.json({
      success: true,
      totalProcessed,
      totalNoBanco,
      registrosLegadosRemovidos: legado.deletedCount,
      area: AREA_LABELS[AREA_ALVO],
      message: `${totalProcessed} questões de Ciências Humanas sincronizadas.`,
      porEdicao: resumo,
      descartes: Object.fromEntries(motivosDescarte),
    });
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : 'Erro desconhecido ao sincronizar.';
    console.error('Falha no seed do dataset:', erro);

    return NextResponse.json({ success: false, error: mensagem }, { status: 500 });
  }
}
