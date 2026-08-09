import { MongoClient, type MongoClientOptions } from 'mongodb';

const options: MongoClientOptions = {
  // Falha rápido em vez de pendurar a requisição por 30s quando o cluster
  // está inacessível — o usuário recebe um erro em vez de uma tela travada.
  serverSelectionTimeoutMS: 8_000,
};

type GlobalComMongo = typeof globalThis & {
  _mongoClientPromise?: Promise<MongoClient>;
};

function conectar(): Promise<MongoClient> {
  const uri = process.env.MONGODB_URI;

  // A checagem é feita aqui, e não no topo do módulo, para que importar este
  // arquivo não derrube o build quando a variável ainda não está definida.
  if (!uri) {
    throw new Error(
      'MONGODB_URI não definida. Copie .env.example para .env.local e preencha a URI do cluster.',
    );
  }

  return new MongoClient(uri, options).connect();
}

/**
 * Cliente compartilhado pelo processo. A promessa vive no objeto global para
 * sobreviver ao hot reload em desenvolvimento — que de outro modo abriria uma
 * conexão nova a cada alteração de arquivo — e para ser reaproveitada entre
 * invocações que caem na mesma instância em produção.
 */
export function getMongoClient(): Promise<MongoClient> {
  const globalComMongo = global as GlobalComMongo;
  globalComMongo._mongoClientPromise ??= conectar();

  return globalComMongo._mongoClientPromise;
}
