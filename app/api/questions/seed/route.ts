import { NextResponse } from 'next/server';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { questionsCollection } from '@/lib/db';
import {
  AREA_LABELS,
  AREA_ALVO,
  curarQuestao,
  curarQuestaoChallenge,
  type QuestaoCurada,
  type ResultadoCuradoria,
} from '@/lib/enem';
import { curarQuestaoBluex } from '@/lib/bluex';
import { getSessao } from '@/lib/session';

type Curador = (bruta: never, sourceFile: string) => ResultadoCuradoria;

/**
 * Arquivos importados, na ordem em que são processados.
 *
 * A ordem importa para o ENEM: o ENEM Challenge também contém 2022 e 2023, que
 * o ENEM-Benchmark já cobre. Como as duas fontes geram a mesma `questionKey`
 * (`"2023-052"`), o Challenge é processado antes e o ENEM-Benchmark — a fonte
 * citada no artigo — grava por último e prevalece nessas edições.
 */
const ARQUIVOS: ReadonlyArray<{ arquivo: string; curar: Curador; rotulo: string }> = [
  {
    arquivo: 'enem-challenge.jsonl',
    curar: curarQuestaoChallenge as Curador,
    rotulo: 'ENEM 2009-2017',
  },
  { arquivo: 'bluex.jsonl', curar: curarQuestaoBluex as Curador, rotulo: 'Fuvest e Unicamp' },
  { arquivo: '2022.jsonl', curar: curarQuestao as Curador, rotulo: 'ENEM 2022' },
  { arquivo: '2023.jsonl', curar: curarQuestao as Curador, rotulo: 'ENEM 2023' },
  { arquivo: '2024.jsonl', curar: curarQuestao as Curador, rotulo: 'ENEM 2024' },
];

type ResumoArquivo = {
  arquivo: string;
  rotulo: string;
  linhas: number;
  importadas: number;
  descartadas: number;
};

export const maxDuration = 60;

/**
 * Carrega os datasets de questões no MongoDB, mantendo apenas Ciências Humanas.
 *
 * O upsert usa `questionKey` e não o campo `id` do dataset: dentro de uma mesma
 * fonte os ids se repetem entre edições, então uma chave baseada só em `id`
 * faria cada edição sobrescrever a anterior.
 */
export async function POST() {
  // Reimportar todas as fontes é caro, e a rota fica exposta na internet
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

    const resumo: ResumoArquivo[] = [];
    const motivosDescarte = new Map<string, number>();
    let totalProcessed = 0;

    for (const { arquivo, curar, rotulo } of ARQUIVOS) {
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
        resumo.push({ arquivo, rotulo, linhas: 0, importadas: 0, descartadas: 0 });
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

        const resultado = curar(bruta as never, arquivo);
        if (resultado.ok) {
          questoes.push(resultado.questao);
        } else {
          motivosDescarte.set(resultado.motivo, (motivosDescarte.get(resultado.motivo) ?? 0) + 1);
        }
      }

      if (questoes.length > 0) {
        // bulkWrite substitui os updateOne sequenciais do seed anterior: uma
        // ida ao cluster por arquivo em vez de uma por questão.
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
        rotulo,
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

    // O total no banco é menor que a soma das importações porque as edições de
    // 2022 e 2023 aparecem nas duas fontes do ENEM e ocupam o mesmo documento.
    const porFonte = await collection
      .aggregate<{ _id: string; total: number }>([
        { $match: { area: AREA_ALVO } },
        { $group: { _id: '$fonteLabel', total: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ])
      .toArray();

    return NextResponse.json({
      success: true,
      totalProcessed,
      totalNoBanco,
      registrosLegadosRemovidos: legado.deletedCount,
      area: AREA_LABELS[AREA_ALVO],
      message: `${totalNoBanco} questões de Ciências Humanas no banco.`,
      porFonte: Object.fromEntries(porFonte.map(({ _id, total }) => [_id ?? 'sem fonte', total])),
      porArquivo: resumo,
      descartes: Object.fromEntries(motivosDescarte),
    });
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : 'Erro desconhecido ao sincronizar.';
    console.error('Falha no seed do dataset:', erro);

    return NextResponse.json({ success: false, error: mensagem }, { status: 500 });
  }
}
