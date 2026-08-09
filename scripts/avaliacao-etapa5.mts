/**
 * Harness da Etapa 5 — Avaliação Técnica e Pedagógica Preliminar.
 *
 * Reproduz o protocolo descrito no artigo: sorteia N questões de Ciências
 * Humanas, simula a resposta de um estudante para cada uma, gera o feedback
 * pelo Tutor IA e mede a latência de cada chamada.
 *
 * A saída é um CSV com uma linha por questão e as quatro colunas da rubrica
 * (correção conceitual, aderência ao gabarito, clareza didática e
 * contextualização) em branco, para preenchimento manual pelos avaliadores, e
 * um JSON com o texto integral de cada feedback, que é o registro do que foi
 * avaliado.
 *
 * Uso:
 *   npm run avaliacao -- [--n 20] [--erros 0.5] [--semente 42]
 *
 *   --n       quantidade de questões (padrão: 20, como no artigo)
 *   --erros   proporção de respostas simuladas que devem ser erradas
 *             (padrão: 0.5 — metade acerta, metade erra)
 *   --saida   prefixo dos arquivos gerados (padrão: avaliacao-<timestamp>)
 *   --semente número inteiro para tornar o sorteio reprodutível
 *
 * O script `avaliacao` do package.json já passa `--env-file=.env.local`, para
 * carregar as chaves, e `--conditions=react-server`, exigido porque `lib/groq`
 * é marcado com `server-only`.
 */

import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { getMongoClient } from '../lib/mongodb.ts';
import { ALTERNATIVAS, AREA_ALVO, type Alternativa, type QuestaoCurada } from '../lib/enem.ts';
import { getPedagogicalFeedback, iaConfigurada, MODELO } from '../lib/groq.ts';

// ---------------------------------------------------------------- argumentos

function argumento(nome: string): string | undefined {
  const indice = process.argv.indexOf(`--${nome}`);

  return indice >= 0 ? process.argv[indice + 1] : undefined;
}

const N = Number.parseInt(argumento('n') ?? '20', 10);
const PROPORCAO_ERROS = Number.parseFloat(argumento('erros') ?? '0.5');
const SEMENTE = Number.parseInt(argumento('semente') ?? '', 10);
const PREFIXO =
  argumento('saida') ?? `avaliacao-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}`;

const DIR_SAIDA = 'resultados-avaliacao';

/** Gerador linear congruente: sorteio reprodutível quando `--semente` é dado. */
function criarSorteio(semente: number): () => number {
  if (!Number.isInteger(semente)) return Math.random;

  let estado = semente >>> 0;

  return () => {
    estado = (estado * 1_664_525 + 1_013_904_223) >>> 0;
    return estado / 0x1_0000_0000;
  };
}

const sorteio = criarSorteio(SEMENTE);

// -------------------------------------------------------------------- saída

type Registro = {
  posicao: number;
  questionKey: string;
  exam: string;
  questionNumber: number;
  gabarito: Alternativa;
  respostaSimulada: Alternativa;
  acertou: boolean;
  latenciaMs: number;
  modelo: string | null;
  tokensEntrada: number | null;
  tokensSaida: number | null;
  feedback: string;
};

function csvEscapar(valor: string | number | boolean | null): string {
  const texto = String(valor ?? '');

  return /[",\n;]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

function montarCsv(registros: Registro[]): string {
  const cabecalho = [
    'posicao',
    'questionKey',
    'exam',
    'questao',
    'gabarito',
    'resposta_simulada',
    'acertou',
    'latencia_ms',
    'tokens_entrada',
    'tokens_saida',
    // Colunas da rubrica (Tabela 2 do artigo), preenchidas pelos avaliadores.
    'correcao_conceitual_1a5',
    'aderencia_gabarito_1a5',
    'clareza_didatica_1a5',
    'contextualizacao_1a5',
    'observacoes',
  ];

  const linhas = registros.map((r) =>
    [
      r.posicao,
      r.questionKey,
      r.exam,
      r.questionNumber,
      r.gabarito,
      r.respostaSimulada,
      r.acertou ? 'sim' : 'nao',
      r.latenciaMs,
      r.tokensEntrada,
      r.tokensSaida,
      '',
      '',
      '',
      '',
      '',
    ]
      .map(csvEscapar)
      .join(','),
  );

  return [cabecalho.join(','), ...linhas].join('\n');
}

function estatisticasLatencia(valores: number[]) {
  if (valores.length === 0) return null;

  const ordenados = [...valores].sort((a, b) => a - b);
  const soma = ordenados.reduce((total, valor) => total + valor, 0);
  const indiceP95 = Math.max(0, Math.ceil(0.95 * ordenados.length) - 1);

  return {
    media: Math.round(soma / ordenados.length),
    mediana: ordenados[Math.floor(ordenados.length / 2)],
    minimo: ordenados[0],
    maximo: ordenados[ordenados.length - 1],
    p95: ordenados[indiceP95],
  };
}

// ------------------------------------------------------------------ execução

async function principal() {
  if (!Number.isInteger(N) || N < 1) {
    throw new Error('O parâmetro --n deve ser um inteiro positivo.');
  }

  if (!iaConfigurada()) {
    console.error(
      'GROQ_API_KEY ausente ou inválida em .env.local.\n' +
        'A avaliação exige o modelo real: em modo demonstração os feedbacks são fixos.',
    );
    process.exit(1);
  }

  const cliente = await getMongoClient();
  const collection = cliente.db('enem_benchmark').collection<QuestaoCurada>('questions');

  const disponiveis = await collection.countDocuments({ area: AREA_ALVO });
  if (disponiveis === 0) {
    throw new Error(
      'Nenhuma questão no banco. Sincronize o dataset pela tela inicial da plataforma antes de avaliar.',
    );
  }

  // Ordena por chave e sorteia com o gerador próprio, em vez de usar $sample,
  // para que --semente realmente torne a amostra reprodutível.
  const todas = await collection.find({ area: AREA_ALVO }).sort({ questionKey: 1 }).toArray();
  const embaralhadas = [...todas];
  for (let i = embaralhadas.length - 1; i > 0; i--) {
    const j = Math.floor(sorteio() * (i + 1));
    [embaralhadas[i], embaralhadas[j]] = [embaralhadas[j], embaralhadas[i]];
  }

  const amostra = embaralhadas.slice(0, Math.min(N, embaralhadas.length));

  console.log(`Avaliação da Etapa 5 — ${amostra.length} questões de Ciências Humanas`);
  console.log(`Modelo: ${MODELO}`);
  console.log(`Banco: ${disponiveis} questões disponíveis`);
  console.log(
    Number.isInteger(SEMENTE) ? `Semente: ${SEMENTE} (amostra reprodutível)` : 'Amostra aleatória',
  );
  console.log('');

  const registros: Registro[] = [];

  for (const [indice, questao] of amostra.entries()) {
    // Alterna entre acerto e erro conforme --erros, para que o corpus cubra os
    // dois caminhos do prompt (validar acerto e explicar distrator).
    const deveErrar = indice < Math.round(amostra.length * PROPORCAO_ERROS);
    const alternativasErradas = ALTERNATIVAS.filter((letra) => letra !== questao.label);
    const resposta = deveErrar
      ? alternativasErradas[Math.floor(sorteio() * alternativasErradas.length)]
      : questao.label;

    const feedback = await getPedagogicalFeedback(questao, resposta);

    registros.push({
      posicao: indice + 1,
      questionKey: questao.questionKey,
      exam: questao.exam,
      questionNumber: questao.questionNumber,
      gabarito: questao.label,
      respostaSimulada: resposta,
      acertou: resposta === questao.label,
      latenciaMs: feedback.latenciaMs,
      modelo: feedback.modelo,
      tokensEntrada: feedback.tokens?.entrada ?? null,
      tokensSaida: feedback.tokens?.saida ?? null,
      feedback: feedback.message,
    });

    console.log(
      `[${String(indice + 1).padStart(2, '0')}/${amostra.length}] ${questao.questionKey} · ` +
        `gabarito ${questao.label} · aluno ${resposta} · ` +
        `${resposta === questao.label ? 'acerto' : 'erro  '} · ${feedback.latenciaMs}ms`,
    );
  }

  const latencias = registros.map((r) => r.latenciaMs);
  const resumo = {
    geradoEm: new Date().toISOString(),
    modelo: MODELO,
    questoesAvaliadas: registros.length,
    proporcaoErrosSimulados: PROPORCAO_ERROS,
    semente: Number.isInteger(SEMENTE) ? SEMENTE : null,
    latenciaMs: estatisticasLatencia(latencias),
    tokens: {
      entradaTotal: registros.reduce((soma, r) => soma + (r.tokensEntrada ?? 0), 0),
      saidaTotal: registros.reduce((soma, r) => soma + (r.tokensSaida ?? 0), 0),
    },
  };

  await mkdir(DIR_SAIDA, { recursive: true });

  const caminhoCsv = path.join(DIR_SAIDA, `${PREFIXO}.csv`);
  const caminhoJson = path.join(DIR_SAIDA, `${PREFIXO}.json`);

  await writeFile(caminhoCsv, montarCsv(registros), 'utf8');
  await writeFile(caminhoJson, JSON.stringify({ resumo, registros }, null, 2), 'utf8');

  console.log('');
  console.log('Resumo de latência (ms):', resumo.latenciaMs);
  console.log(`Tokens — entrada: ${resumo.tokens.entradaTotal}, saída: ${resumo.tokens.saidaTotal}`);
  console.log('');
  console.log(`Planilha da rubrica: ${caminhoCsv}`);
  console.log(`Feedbacks completos: ${caminhoJson}`);
  console.log('');
  console.log(
    'Preencha as quatro colunas de nota (1 a 5) no CSV conforme a rubrica da Tabela 2 do artigo.',
  );

  await cliente.close();
}

principal().catch((erro: unknown) => {
  console.error('\nFalha na avaliação:', erro instanceof Error ? erro.message : erro);
  process.exit(1);
});
