/**
 * Regras de domínio do ENEM usadas na curadoria do dataset ENEM-Benchmark.
 *
 * O dataset da Maritaca AI distribui cada edição como um arquivo JSONL com as
 * 180 questões objetivas na ordem oficial do caderno, mas não traz o campo da
 * área do conhecimento. A área é derivada da posição da questão, que é fixa:
 *
 *   001-045  Linguagens, Códigos e suas Tecnologias
 *   046-090  Ciências Humanas e suas Tecnologias
 *   091-135  Ciências da Natureza e suas Tecnologias
 *   136-180  Matemática e suas Tecnologias
 *
 * A plataforma trabalha exclusivamente com o intervalo 046-090, o que
 * corresponde a 45 questões por edição (135 no ciclo 2022-2024).
 */

export const AREA_SLUGS = ['linguagens', 'humanas', 'natureza', 'matematica'] as const;

export type AreaSlug = (typeof AREA_SLUGS)[number];

export const AREA_LABELS: Record<AreaSlug, string> = {
  linguagens: 'Linguagens, Códigos e suas Tecnologias',
  humanas: 'Ciências Humanas e suas Tecnologias',
  natureza: 'Ciências da Natureza e suas Tecnologias',
  matematica: 'Matemática e suas Tecnologias',
};

/** Área em que a plataforma atua, conforme o escopo definido no artigo. */
export const AREA_ALVO: AreaSlug = 'humanas';

/** Primeira e última questão de cada área no caderno oficial. */
const FAIXAS: ReadonlyArray<{ ate: number; slug: AreaSlug }> = [
  { ate: 45, slug: 'linguagens' },
  { ate: 90, slug: 'humanas' },
  { ate: 135, slug: 'natureza' },
  { ate: 180, slug: 'matematica' },
];

export const QUESTOES_POR_EDICAO = 180;

/** Alternativas do ENEM, na ordem em que aparecem no array `alternatives`. */
export const ALTERNATIVAS = ['A', 'B', 'C', 'D', 'E'] as const;

export type Alternativa = (typeof ALTERNATIVAS)[number];

export function isAlternativa(valor: unknown): valor is Alternativa {
  return typeof valor === 'string' && (ALTERNATIVAS as readonly string[]).includes(valor);
}

export function isAreaSlug(valor: unknown): valor is AreaSlug {
  return typeof valor === 'string' && (AREA_SLUGS as readonly string[]).includes(valor);
}

/**
 * Extrai o número da questão a partir do campo `id` do dataset
 * (`"questao_46"` -> `46`). Devolve `null` para ids fora do formato.
 */
export function numeroDaQuestao(id: string): number | null {
  const match = /(\d+)\s*$/.exec(id ?? '');
  if (!match) return null;

  const numero = Number.parseInt(match[1], 10);
  if (!Number.isInteger(numero) || numero < 1 || numero > QUESTOES_POR_EDICAO) return null;

  return numero;
}

/** Área do conhecimento correspondente à posição da questão no caderno. */
export function areaDaQuestao(numero: number): AreaSlug | null {
  return FAIXAS.find((faixa) => numero <= faixa.ate)?.slug ?? null;
}

/**
 * Chave única de uma questão no banco. O campo `id` do dataset se repete entre
 * edições (todo arquivo vai de `questao_01` a `questao_180`), então usá-lo
 * sozinho como chave de upsert faria uma edição sobrescrever a anterior.
 */
export function chaveDaQuestao(exam: string, numero: number): string {
  return `${exam}-${String(numero).padStart(3, '0')}`;
}

/** Documento de questão como fica persistido no MongoDB após a curadoria. */
export type QuestaoCurada = {
  questionKey: string;
  id: string;
  exam: string;
  year: number;
  questionNumber: number;
  area: AreaSlug;
  areaLabel: string;
  question: string;
  alternatives: string[];
  label: Alternativa;
  figures: string[];
  description: string[];
  hasFigure: boolean;
  ledor: boolean;
  sourceFile: string;
  importedAt: Date;
};

/**
 * Questão como ela chega ao navegador. O gabarito é removido de propósito: a
 * correção é feita no servidor, para que a resposta certa não fique visível no
 * DevTools antes de o aluno responder.
 */
export type QuestaoPublica = Omit<QuestaoCurada, 'label' | 'sourceFile' | 'importedAt'>;

/** Formato bruto de uma linha do JSONL do ENEM-Benchmark. */
type LinhaBruta = {
  id?: string;
  exam?: string;
  question?: string;
  alternatives?: unknown;
  label?: string;
  figures?: unknown;
  description?: unknown;
  ledor?: unknown;
};

export type ResultadoCuradoria =
  | { ok: true; questao: QuestaoCurada }
  | { ok: false; motivo: string };

/**
 * Valida e normaliza uma linha do dataset. Questões malformadas ou de outras
 * áreas são rejeitadas com o motivo, para que o seed possa reportar o que
 * descartou em vez de falhar silenciosamente.
 */
export function curarQuestao(
  bruta: LinhaBruta,
  sourceFile: string,
  areaAlvo: AreaSlug = AREA_ALVO,
): ResultadoCuradoria {
  const id = typeof bruta.id === 'string' ? bruta.id : '';
  const exam = typeof bruta.exam === 'string' ? bruta.exam : '';

  if (!id || !exam) return { ok: false, motivo: 'registro sem "id" ou "exam"' };

  const questionNumber = numeroDaQuestao(id);
  if (questionNumber === null) return { ok: false, motivo: `id fora do formato esperado: "${id}"` };

  const area = areaDaQuestao(questionNumber);
  if (area === null) return { ok: false, motivo: `questão ${questionNumber} fora do caderno` };
  if (area !== areaAlvo) return { ok: false, motivo: 'fora da área de Ciências Humanas' };

  const alternatives = Array.isArray(bruta.alternatives)
    ? bruta.alternatives.filter((alt): alt is string => typeof alt === 'string')
    : [];

  if (alternatives.length !== ALTERNATIVAS.length) {
    return { ok: false, motivo: `esperava ${ALTERNATIVAS.length} alternativas, veio ${alternatives.length}` };
  }

  const label = bruta.label;
  if (!isAlternativa(label)) return { ok: false, motivo: `gabarito inválido: "${label}"` };

  const question = typeof bruta.question === 'string' ? bruta.question.trim() : '';
  if (!question) return { ok: false, motivo: 'enunciado vazio' };

  const figures = Array.isArray(bruta.figures)
    ? bruta.figures.filter((f): f is string => typeof f === 'string')
    : [];
  const description = Array.isArray(bruta.description)
    ? bruta.description.filter((d): d is string => typeof d === 'string')
    : [];

  const year = Number.parseInt(exam, 10);

  return {
    ok: true,
    questao: {
      questionKey: chaveDaQuestao(exam, questionNumber),
      id,
      exam,
      year: Number.isInteger(year) ? year : 0,
      questionNumber,
      area,
      areaLabel: AREA_LABELS[area],
      question,
      alternatives,
      label,
      figures,
      description,
      hasFigure: figures.length > 0 || description.length > 0,
      ledor: bruta.ledor === true,
      sourceFile,
      importedAt: new Date(),
    },
  };
}

/**
 * O dataset substitui imagens por `[[placeholder]]` no enunciado. Remove esse
 * marcador para exibição, preservando o restante do texto.
 */
export function limparEnunciado(enunciado: string): string {
  return enunciado
    .replace(/\[\[.*?\]\]/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
