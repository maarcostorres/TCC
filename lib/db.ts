import type { Collection, Db } from 'mongodb';
import { getMongoClient } from '@/lib/mongodb';
import type { QuestaoCurada } from '@/lib/enem';

const DB_NAME = 'enem_benchmark';

export type Usuario = {
  email: string;
  nome: string;
  senhaHash: string;
  criadoEm: Date;
};

/**
 * Uma resposta submetida pelo estudante. É a base de toda a análise de
 * desempenho: sem esse registro o dashboard não teria dados reais.
 */
export type Tentativa = {
  userId: string;
  questionKey: string;
  exam: string;
  questionNumber: number;
  area: string;
  /** 'estudo' = questão avulsa; 'simulado' = item dentro de uma mini prova. */
  origem: 'estudo' | 'simulado';
  /** Agrupa os itens de um mesmo simulado. */
  sessaoId: string | null;
  resposta: string;
  gabarito: string;
  acertou: boolean;
  /** Latência da chamada ao modelo, em ms. `null` quando não houve feedback. */
  latenciaIaMs: number | null;
  /** `true` quando o feedback veio do modo demonstração, não do modelo. */
  feedbackSimulado: boolean;
  respondidoEm: Date;
};

let indicesGarantidos: Promise<void> | null = null;

/**
 * Cria os índices uma única vez por processo. `questionKey` e `email` são
 * únicos porque são as chaves de upsert; os demais servem às consultas do
 * dashboard.
 */
async function garantirIndices(db: Db): Promise<void> {
  await Promise.all([
    db.collection('questions').createIndex({ questionKey: 1 }, { unique: true }),
    db.collection('questions').createIndex({ area: 1, exam: 1 }),
    db.collection('users').createIndex({ email: 1 }, { unique: true }),
    db.collection('attempts').createIndex({ userId: 1, respondidoEm: -1 }),
    db.collection('attempts').createIndex({ userId: 1, sessaoId: 1 }),
  ]);
}

export async function getDb(): Promise<Db> {
  const client = await getMongoClient();
  const db = client.db(DB_NAME);

  indicesGarantidos ??= garantirIndices(db).catch((erro: unknown) => {
    // Um índice que falha não deve derrubar a requisição: a aplicação continua
    // correta, apenas mais lenta. O caso típico é uma base que ainda tem dados
    // do esquema antigo — sincronizar o dataset resolve.
    const mensagem = erro instanceof Error ? erro.message : String(erro);
    console.warn(`Índices do MongoDB não criados: ${mensagem}`);
  });
  await indicesGarantidos;

  return db;
}

export async function questionsCollection(): Promise<Collection<QuestaoCurada>> {
  return (await getDb()).collection<QuestaoCurada>('questions');
}

export async function usersCollection(): Promise<Collection<Usuario>> {
  return (await getDb()).collection<Usuario>('users');
}

export async function attemptsCollection(): Promise<Collection<Tentativa>> {
  return (await getDb()).collection<Tentativa>('attempts');
}
