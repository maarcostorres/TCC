/**
 * Curadoria do dataset BLUEX — vestibulares da USP (Fuvest) e da Unicamp
 * (Convest), edições de 2018 a 2025.
 *
 * Diferença importante em relação aos datasets do ENEM: o BLUEX anota a
 * disciplina de cada questão. Não é preciso deduzir a área pela posição no
 * caderno, o que elimina de uma vez a classe de erro que a faixa 046-090
 * introduz nas edições antigas do ENEM.
 *
 * Duas particularidades da fonte moldam este arquivo:
 *
 *   1. A Unicamp usa quatro alternativas, não cinco. A validação compartilhada
 *      em `lib/enem.ts` aceita as duas contagens.
 *   2. Parte das questões tem as *alternativas* em imagem, não em texto. Sem os
 *      arquivos de imagem elas ficam sem resposta possível, e são descartadas.
 */

import {
  AREA_ALVO,
  AREA_LABELS,
  FONTE_LABELS,
  validarAlternativas,
  type AreaSlug,
  type Fonte,
  type QuestaoCurada,
  type ResultadoCuradoria,
} from '@/lib/enem';

/** Disciplinas do BLUEX que compõem a área de Ciências Humanas. */
const DISCIPLINAS_HUMANAS = new Set(['history', 'geography', 'philosophy', 'sociology']);

/** Nome em português das disciplinas anotadas no dataset. */
const DISCIPLINA_LABELS: Record<string, string> = {
  history: 'História',
  geography: 'Geografia',
  philosophy: 'Filosofia',
  sociology: 'Sociologia',
  portuguese: 'Português',
  english: 'Inglês',
  mathematics: 'Matemática',
  physics: 'Física',
  chemistry: 'Química',
  biology: 'Biologia',
};

/** Prefixo da universidade no campo `id` para a banca correspondente. */
const BANCAS: Record<string, Fonte> = {
  USP: 'fuvest',
  UNICAMP: 'unicamp',
};

/** Formato bruto de uma linha do BLUEX. */
type LinhaBluex = {
  id?: string;
  number?: number;
  question?: string;
  alternatives?: unknown;
  answer?: string;
  subject?: unknown;
  alternatives_type?: string;
  has_associated_images?: boolean;
  blind_captions?: unknown;
  context_captions?: unknown;
};

type IdentificacaoBluex = {
  fonte: Fonte;
  ano: number;
  numero: number;
  /** Sufixo do dia de prova, presente só na Unicamp (`day2`). */
  dia: string | null;
};

/**
 * Decompõe o campo `id` do BLUEX, que vem em três formatos:
 * `USP_2020_56`, `UNICAMP_2021_59` e `UNICAMP_2021_59_day2`.
 */
export function identificar(id: string): IdentificacaoBluex | null {
  const partes = id.split('_');
  if (partes.length < 3) return null;

  const fonte = BANCAS[partes[0]];
  const ano = Number.parseInt(partes[1], 10);
  const numero = Number.parseInt(partes[2], 10);

  if (!fonte || !Number.isInteger(ano) || !Number.isInteger(numero)) return null;

  return { fonte, ano, numero, dia: partes[3] ?? null };
}

/**
 * Chave única da questão no banco. Leva a banca no prefixo porque Fuvest e
 * Unicamp numeram suas provas de forma independente — sem ele, a questão 45 da
 * Fuvest 2020 e a 45 da Unicamp 2020 disputariam o mesmo documento.
 */
export function chaveBluex({ fonte, ano, numero, dia }: IdentificacaoBluex): string {
  const base = `${fonte}-${ano}-${String(numero).padStart(3, '0')}`;

  return dia ? `${base}-${dia}` : base;
}

/**
 * Remove o rótulo que o dataset prefixa em cada alternativa (`"a) texto"`).
 * A letra é reposta pela interface a partir da posição, então mantê-la aqui
 * duplicaria o rótulo na tela.
 */
function semRotulo(alternativa: string): string {
  return alternativa.replace(/^\s*[a-eA-E]\s*[).\-–]\s*/, '').trim();
}

export function curarQuestaoBluex(
  bruta: LinhaBluex,
  sourceFile: string,
  areaAlvo: AreaSlug = AREA_ALVO,
): ResultadoCuradoria {
  const id = typeof bruta.id === 'string' ? bruta.id : '';
  if (!id) return { ok: false, motivo: 'registro sem "id"' };

  const identificacao = identificar(id);
  if (!identificacao) return { ok: false, motivo: `id fora do formato esperado: "${id}"` };

  const disciplinasBrutas = Array.isArray(bruta.subject)
    ? bruta.subject.filter((s): s is string => typeof s === 'string')
    : [];

  // A área alvo da plataforma é Ciências Humanas; o BLUEX fala em disciplinas.
  // Uma questão interdisciplinar (Geografia e Biologia, por exemplo) entra pela
  // parte de Humanas, e as duas disciplinas ficam registradas.
  const ehDaArea = disciplinasBrutas.some((d) => DISCIPLINAS_HUMANAS.has(d));
  if (areaAlvo === AREA_ALVO && !ehDaArea) {
    return { ok: false, motivo: 'fora da área de Ciências Humanas' };
  }

  if (bruta.alternatives_type === 'images') {
    return { ok: false, motivo: 'alternativas em imagem, sem texto para responder' };
  }

  const alternatives = (
    Array.isArray(bruta.alternatives)
      ? bruta.alternatives.filter((alt): alt is string => typeof alt === 'string')
      : []
  ).map(semRotulo);

  const alternativasValidas = validarAlternativas(alternatives, bruta.answer);
  if (!alternativasValidas.ok) return alternativasValidas;

  const question = typeof bruta.question === 'string' ? bruta.question.trim() : '';
  if (!question) return { ok: false, motivo: 'enunciado vazio' };

  // O BLUEX separa legendas em duas listas: as do enunciado e as do texto de
  // apoio. Para a plataforma as duas cumprem o mesmo papel do `description` do
  // ENEM-Benchmark — descrever em texto o que a imagem mostrava.
  const legendas = [
    ...(Array.isArray(bruta.blind_captions) ? bruta.blind_captions : []),
    ...(Array.isArray(bruta.context_captions) ? bruta.context_captions : []),
  ]
    .filter((linha): linha is string => typeof linha === 'string')
    .map((linha) => linha.trim())
    .filter((linha) => linha !== '');

  const temImagem = bruta.has_associated_images === true;
  if (temImagem && legendas.length === 0) {
    return { ok: false, motivo: 'questão com imagem e sem legenda textual' };
  }

  const { fonte, ano, numero } = identificacao;

  return {
    ok: true,
    questao: {
      questionKey: chaveBluex(identificacao),
      id,
      fonte,
      fonteLabel: FONTE_LABELS[fonte],
      exam: String(ano),
      year: ano,
      questionNumber: numero,
      area: AREA_ALVO,
      areaLabel: AREA_LABELS[AREA_ALVO],
      disciplinas: disciplinasBrutas.map((d) => DISCIPLINA_LABELS[d] ?? d),
      question,
      alternatives,
      label: alternativasValidas.label,
      figures: [],
      description: legendas,
      hasFigure: temImagem,
      ledor: false,
      sourceFile,
      importedAt: new Date(),
    },
  } satisfies { ok: true; questao: QuestaoCurada };
}
