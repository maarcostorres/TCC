/**
 * Regras de domínio do ENEM usadas na curadoria dos datasets de questões.
 *
 * Os datasets do ENEM distribuem cada edição com as 180 questões objetivas na
 * ordem do caderno, mas nenhum deles traz o campo da área do conhecimento. A
 * área é derivada da posição da questão — e essa posição mudou ao longo do
 * tempo, o que é a armadilha central deste arquivo.
 *
 * Layout a partir de 2017 (e também em 2009):
 *
 *   001-045  Linguagens, Códigos e suas Tecnologias   (2009: Ciências da Natureza)
 *   046-090  Ciências Humanas e suas Tecnologias
 *   091-135  Ciências da Natureza e suas Tecnologias  (2009: Linguagens)
 *   136-180  Matemática e suas Tecnologias
 *
 * Layout de 2010 a 2016:
 *
 *   001-045  Ciências Humanas e suas Tecnologias
 *   046-090  Ciências da Natureza e suas Tecnologias
 *   091-135  Linguagens, Códigos e suas Tecnologias
 *   136-180  Matemática e suas Tecnologias
 *
 * Aplicar a faixa 046-090 a todos os anos importaria Física, Química e Biologia
 * rotuladas como Ciências Humanas em sete das nove edições históricas. A
 * distinção foi verificada lendo o conteúdo das questões de cada faixa em cada
 * ano, não deduzida de documentação.
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

/** Ordem das áreas no caderno, do layout usado em 2017 em diante. */
const FAIXAS_MODERNAS: ReadonlyArray<{ ate: number; slug: AreaSlug }> = [
  { ate: 45, slug: 'linguagens' },
  { ate: 90, slug: 'humanas' },
  { ate: 135, slug: 'natureza' },
  { ate: 180, slug: 'matematica' },
];

/** Ordem das áreas no caderno entre 2010 e 2016. */
const FAIXAS_2010_2016: ReadonlyArray<{ ate: number; slug: AreaSlug }> = [
  { ate: 45, slug: 'humanas' },
  { ate: 90, slug: 'natureza' },
  { ate: 135, slug: 'linguagens' },
  { ate: 180, slug: 'matematica' },
];

export const QUESTOES_POR_EDICAO = 180;

/**
 * Alternativas possíveis, na ordem em que aparecem no array `alternatives`.
 *
 * O ENEM e a Fuvest usam cinco; a Unicamp usa quatro. A lista é o teto, e cada
 * questão declara quantas de fato tem.
 */
export const ALTERNATIVAS = ['A', 'B', 'C', 'D', 'E'] as const;

/** Menor quantidade de alternativas aceita (Unicamp). */
export const MIN_ALTERNATIVAS = 4;

export type Alternativa = (typeof ALTERNATIVAS)[number];

/** Banca de origem da questão. */
export const FONTES = ['enem', 'fuvest', 'unicamp'] as const;

export type Fonte = (typeof FONTES)[number];

export const FONTE_LABELS: Record<Fonte, string> = {
  enem: 'ENEM',
  fuvest: 'Fuvest — USP',
  unicamp: 'Unicamp',
};

export function isFonte(valor: unknown): valor is Fonte {
  return typeof valor === 'string' && (FONTES as readonly string[]).includes(valor);
}

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

/**
 * Área do conhecimento correspondente à posição da questão no caderno daquele
 * ano. O ano importa: entre 2010 e 2016 as áreas ocupavam outras faixas.
 */
export function areaDaQuestao(numero: number, ano: number): AreaSlug | null {
  const faixas = ano >= 2010 && ano <= 2016 ? FAIXAS_2010_2016 : FAIXAS_MODERNAS;

  return faixas.find((faixa) => numero <= faixa.ate)?.slug ?? null;
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
  /** Banca de origem: ENEM, Fuvest ou Unicamp. */
  fonte: Fonte;
  fonteLabel: string;
  exam: string;
  year: number;
  questionNumber: number;
  area: AreaSlug;
  areaLabel: string;
  /**
   * Disciplinas anotadas na fonte (`História`, `Geografia`...). Vem vazio para
   * o ENEM, cujos datasets não trazem essa anotação — só a área.
   */
  disciplinas: string[];
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

/**
 * Procedência da questão, como aparece na interface e no prompt do tutor:
 * `"ENEM 2023"`, `"Fuvest — USP 2020"`, `"Unicamp 2021"`.
 *
 * O `fonteLabel` é opcional porque documentos gravados antes da entrada de
 * Fuvest e Unicamp não têm o campo. Enquanto a base não é ressincronizada, eles
 * são o que sempre foram: questões do ENEM.
 */
export function rotuloDaFonte(questao: { fonteLabel?: string; exam: string }): string {
  return `${questao.fonteLabel || FONTE_LABELS.enem} ${questao.exam}`;
}

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

  const year = Number.parseInt(exam, 10);
  const area = areaDaQuestao(questionNumber, year);
  if (area === null) return { ok: false, motivo: `questão ${questionNumber} fora do caderno` };
  if (area !== areaAlvo) return { ok: false, motivo: 'fora da área de Ciências Humanas' };

  const alternatives = Array.isArray(bruta.alternatives)
    ? bruta.alternatives.filter((alt): alt is string => typeof alt === 'string')
    : [];

  const alternativasValidas = validarAlternativas(alternatives, bruta.label);
  if (!alternativasValidas.ok) return alternativasValidas;

  const question = typeof bruta.question === 'string' ? bruta.question.trim() : '';
  if (!question) return { ok: false, motivo: 'enunciado vazio' };

  const figures = Array.isArray(bruta.figures)
    ? bruta.figures.filter((f): f is string => typeof f === 'string')
    : [];
  const description = Array.isArray(bruta.description)
    ? bruta.description.filter((d): d is string => typeof d === 'string')
    : [];

  return {
    ok: true,
    questao: {
      questionKey: chaveDaQuestao(exam, questionNumber),
      id,
      fonte: 'enem',
      fonteLabel: FONTE_LABELS.enem,
      exam,
      year: Number.isInteger(year) ? year : 0,
      questionNumber,
      area,
      areaLabel: AREA_LABELS[area],
      disciplinas: [],
      question,
      alternatives,
      label: alternativasValidas.label,
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
 * Valida a lista de alternativas e o gabarito de qualquer fonte.
 *
 * Aceita 4 (Unicamp) ou 5 (ENEM e Fuvest) e exige que o gabarito aponte para
 * uma alternativa que exista: um "E" numa questão de quatro alternativas é
 * dado corrompido, e deixá-lo passar produziria uma questão sem resposta certa.
 */
export function validarAlternativas(
  alternatives: string[],
  gabaritoBruto: unknown,
): { ok: true; label: Alternativa } | { ok: false; motivo: string } {
  if (alternatives.length < MIN_ALTERNATIVAS || alternatives.length > ALTERNATIVAS.length) {
    return {
      ok: false,
      motivo: `esperava de ${MIN_ALTERNATIVAS} a ${ALTERNATIVAS.length} alternativas, veio ${alternatives.length}`,
    };
  }

  const label = typeof gabaritoBruto === 'string' ? gabaritoBruto.trim().toUpperCase() : '';
  if (!isAlternativa(label)) return { ok: false, motivo: `gabarito inválido: "${gabaritoBruto}"` };

  const indice = ALTERNATIVAS.indexOf(label);
  if (indice >= alternatives.length) {
    return {
      ok: false,
      motivo: `gabarito "${label}" fora das ${alternatives.length} alternativas existentes`,
    };
  }

  return { ok: true, label };
}

// ---------------------------------------------------------------------------
// ENEM Challenge (edições de 2009 a 2017)
// ---------------------------------------------------------------------------

/** Formato bruto de uma linha do dataset ENEM Challenge. */
type LinhaChallenge = {
  id?: string;
  /** Identifica a aplicação: `"2016"` e `"2016_2"` são provas diferentes. */
  exam_id?: string;
  exam_year?: string;
  question_number?: number;
  nullified?: boolean;
  question?: string;
  choices?: { text?: unknown } | unknown;
  answerKey?: string;
};

/**
 * Cura uma questão do ENEM Challenge, que cobre as edições anteriores às do
 * ENEM-Benchmark. Mesmo exame, esquema diferente: o gabarito vem em
 * `answerKey`, as alternativas em `choices.text`, e há uma marcação de questões
 * anuladas pelo INEP — que não têm resposta certa e por isso são descartadas.
 */
export function curarQuestaoChallenge(
  bruta: LinhaChallenge,
  sourceFile: string,
  areaAlvo: AreaSlug = AREA_ALVO,
): ResultadoCuradoria {
  const id = typeof bruta.id === 'string' ? bruta.id : '';
  const exam = typeof bruta.exam_year === 'string' ? bruta.exam_year : '';
  const questionNumber = typeof bruta.question_number === 'number' ? bruta.question_number : null;

  // A chave usa `exam_id`, não `exam_year`: 2016 teve duas aplicações
  // (`"2016"` e `"2016_2"`, a reaplicação) que reiniciam a numeração das
  // questões. Chavear pelo ano faria a reaplicação sobrescrever 31 questões da
  // prova regular — o mesmo defeito que a chave composta já corrigiu uma vez.
  const aplicacao = typeof bruta.exam_id === 'string' && bruta.exam_id ? bruta.exam_id : exam;

  if (!id || !exam) return { ok: false, motivo: 'registro sem "id" ou "exam_year"' };
  if (questionNumber === null) return { ok: false, motivo: 'registro sem "question_number"' };
  if (bruta.nullified === true) return { ok: false, motivo: 'questão anulada pelo INEP' };

  const year = Number.parseInt(exam, 10);
  const area = areaDaQuestao(questionNumber, year);
  if (area === null) return { ok: false, motivo: `questão ${questionNumber} fora do caderno` };
  if (area !== areaAlvo) return { ok: false, motivo: 'fora da área de Ciências Humanas' };

  const bruteChoices = (bruta.choices ?? {}) as { text?: unknown };
  const alternatives = Array.isArray(bruteChoices.text)
    ? bruteChoices.text.filter((alt): alt is string => typeof alt === 'string').map((t) => t.trim())
    : [];

  const alternativasValidas = validarAlternativas(alternatives, bruta.answerKey);
  if (!alternativasValidas.ok) return alternativasValidas;

  const question = typeof bruta.question === 'string' ? bruta.question.trim() : '';
  if (!question) return { ok: false, motivo: 'enunciado vazio' };

  return {
    ok: true,
    questao: {
      questionKey: chaveDaQuestao(aplicacao, questionNumber),
      id,
      fonte: 'enem',
      fonteLabel: FONTE_LABELS.enem,
      // `exam` guarda o ano, e não a aplicação, para que o filtro por edição e
      // o agrupamento do painel continuem funcionando com quatro dígitos.
      exam,
      year: Number.isInteger(year) ? year : 0,
      questionNumber,
      area,
      areaLabel: AREA_LABELS[area],
      disciplinas: [],
      question,
      alternatives,
      label: alternativasValidas.label,
      figures: [],
      description: [],
      hasFigure: false,
      ledor: false,
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
