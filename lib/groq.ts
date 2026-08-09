import 'server-only';
import Groq from 'groq-sdk';
import { limparEnunciado, type Alternativa } from '@/lib/enem';

/** Modelo usado em todo o sistema (Llama 3.3 70B, servido pela Groq). */
export const MODELO = 'llama-3.3-70b-versatile';

/**
 * Resultado de uma chamada ao modelo.
 *
 * `latenciaMs` existe porque "baixa latência na resposta do Tutor IA" é um
 * requisito não funcional do sistema: sem medir não há como verificá-lo.
 */
export type RespostaIA = {
  message: string;
  /** `true` quando veio do modo demonstração, sem chamar a Groq. */
  isMock: boolean;
  latenciaMs: number;
  modelo: string | null;
  tokens: { entrada: number; saida: number } | null;
};

const MAX_TOKENS_FEEDBACK = 512;
const MAX_TOKENS_CHAT = 1024;
const TEMPERATURA = 0.5;

let clienteMemoizado: Groq | null = null;

/**
 * A chave é lida a cada chamada, e não no topo do módulo, para que o build não
 * dependa dela e para que trocar o `.env.local` tenha efeito sem rebuild.
 */
function getCliente(): Groq | null {
  const apiKey = process.env.GROQ_API_KEY ?? '';
  if (!apiKey.startsWith('gsk_')) return null;

  clienteMemoizado ??= new Groq({ apiKey });

  return clienteMemoizado;
}

export function iaConfigurada(): boolean {
  return getCliente() !== null;
}

const AVISO_DEMO =
  '\n\n_Modo demonstração: defina GROQ_API_KEY no .env.local para receber a explicação gerada pelo modelo._';

function demo(message: string, inicio: number): RespostaIA {
  return {
    message: message + AVISO_DEMO,
    isMock: true,
    latenciaMs: Math.round(performance.now() - inicio),
    modelo: null,
    tokens: null,
  };
}

type Mensagem = { role: 'system' | 'user'; content: string };

async function chamarModelo(
  mensagens: Mensagem[],
  maxTokens: number,
  inicio: number,
): Promise<RespostaIA> {
  const cliente = getCliente();
  if (!cliente) throw new Error('Cliente Groq não configurado.');

  const completion = await cliente.chat.completions.create({
    model: MODELO,
    messages: mensagens,
    max_tokens: maxTokens,
    temperature: TEMPERATURA,
  });

  return {
    message: completion.choices[0]?.message?.content?.trim() || 'O modelo não retornou conteúdo.',
    isMock: false,
    latenciaMs: Math.round(performance.now() - inicio),
    modelo: completion.model ?? MODELO,
    tokens: {
      entrada: completion.usage?.prompt_tokens ?? 0,
      saida: completion.usage?.completion_tokens ?? 0,
    },
  };
}

// ---------------------------------------------------------------------------
// Tutor livre
// ---------------------------------------------------------------------------

const SISTEMA_TUTOR = [
  'Você é um tutor de Ciências Humanas para o ENEM, falando com um estudante do ensino médio brasileiro.',
  'Responda sempre em português do Brasil, com linguagem clara e acessível.',
  'Cubra História, Geografia, Filosofia e Sociologia conforme a matriz de referência do ENEM.',
  'Seja direto: prefira três parágrafos curtos a um texto longo.',
  'Quando não tiver certeza de um dado factual, diga isso em vez de inventar.',
].join(' ');

export async function getTutorResponse(mensagemDoAluno: string): Promise<RespostaIA> {
  const inicio = performance.now();

  if (!iaConfigurada()) {
    return demo(
      'Esta é uma resposta de exemplo do Tutor IA. Com a chave da Groq configurada, aqui apareceria uma explicação de Ciências Humanas gerada pelo modelo Llama 3.3.',
      inicio,
    );
  }

  try {
    return await chamarModelo(
      [
        { role: 'system', content: SISTEMA_TUTOR },
        { role: 'user', content: mensagemDoAluno },
      ],
      MAX_TOKENS_CHAT,
      inicio,
    );
  } catch (erro) {
    console.error('Falha na chamada ao Tutor IA:', erro);

    return {
      message: 'Não consegui falar com o serviço de IA agora. Tente novamente em instantes.',
      isMock: true,
      latenciaMs: Math.round(performance.now() - inicio),
      modelo: null,
      tokens: null,
    };
  }
}

// ---------------------------------------------------------------------------
// Feedback pedagógico sobre uma questão
// ---------------------------------------------------------------------------

export type ContextoFeedback = {
  question: string;
  alternatives: string[];
  description: string[];
  label: Alternativa;
  exam: string;
  questionNumber: number;
};

const SISTEMA_FEEDBACK = [
  'Você é um professor de Ciências Humanas corrigindo uma questão do ENEM com um estudante.',
  'Escreva em português do Brasil, no máximo três parágrafos curtos, sem listas e sem títulos.',
  'Trate o gabarito oficial como correto: sua tarefa é explicá-lo, nunca contestá-lo.',
  'Não repita o enunciado; vá direto ao raciocínio.',
  'Termine com uma frase de incentivo curta.',
].join(' ');

function montarPrompt(questao: ContextoFeedback, respostaDoAluno: Alternativa): string {
  const letras = ['A', 'B', 'C', 'D', 'E'];
  const alternativas = questao.alternatives
    .map((texto, indice) => `${letras[indice]}) ${texto}`)
    .join('\n');

  const acertou = respostaDoAluno === questao.label;

  const instrucao = acertou
    ? 'O estudante ACERTOU. Confirme por que a alternativa está correta e acrescente um contexto histórico, geográfico, filosófico ou sociológico que aprofunde o tema.'
    : `O estudante ERROU. Explique por que a alternativa ${respostaDoAluno} é um distrator — qual raciocínio equivocado leva a ela — e em seguida por que a alternativa ${questao.label} é a correta.`;

  return [
    `Questão ${questao.questionNumber} do ENEM ${questao.exam}, área de Ciências Humanas.`,
    '',
    'ENUNCIADO:',
    limparEnunciado(questao.question),
    questao.description.length > 0
      ? `\nDESCRIÇÃO DA IMAGEM QUE ACOMPANHA A QUESTÃO:\n${questao.description.join('\n')}`
      : '',
    '',
    'ALTERNATIVAS:',
    alternativas,
    '',
    `GABARITO OFICIAL: ${questao.label}`,
    `RESPOSTA DO ESTUDANTE: ${respostaDoAluno}`,
    '',
    instrucao,
  ]
    .filter(Boolean)
    .join('\n');
}

export async function getPedagogicalFeedback(
  questao: ContextoFeedback,
  respostaDoAluno: Alternativa,
): Promise<RespostaIA> {
  const inicio = performance.now();
  const acertou = respostaDoAluno === questao.label;

  if (!iaConfigurada()) {
    return demo(
      acertou
        ? `Resposta correta. A alternativa ${questao.label} é de fato o gabarito desta questão. Com a IA ativada, aqui viria a explicação do raciocínio e um aprofundamento do tema.`
        : `A resposta correta era a alternativa ${questao.label}. Com a IA ativada, aqui viria a explicação de por que a alternativa ${respostaDoAluno} é um distrator e como chegar ao gabarito.`,
      inicio,
    );
  }

  try {
    return await chamarModelo(
      [
        { role: 'system', content: SISTEMA_FEEDBACK },
        { role: 'user', content: montarPrompt(questao, respostaDoAluno) },
      ],
      MAX_TOKENS_FEEDBACK,
      inicio,
    );
  } catch (erro) {
    console.error('Falha ao gerar feedback pedagógico:', erro);

    return {
      message: `A resposta correta era a alternativa ${questao.label}. Não consegui gerar a explicação agora — tente novamente em instantes.`,
      isMock: true,
      latenciaMs: Math.round(performance.now() - inicio),
      modelo: null,
      tokens: null,
    };
  }
}
