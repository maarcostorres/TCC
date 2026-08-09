import 'server-only';
import {
  createHmac,
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
  type ScryptOptions,
} from 'node:crypto';
import { promisify } from 'node:util';

// `promisify` resolve para a sobrecarga sem `options`, então o tipo é declarado
// à mão para poder passar os parâmetros N/r/p.
const scrypt = promisify(scryptCallback) as (
  senha: string | Buffer,
  sal: string | Buffer,
  tamanho: number,
  opcoes?: ScryptOptions,
) => Promise<Buffer>;

/** Parâmetros do scrypt. Guardados junto do hash para permitir migração. */
const SCRYPT = { N: 16_384, r: 8, p: 1, tamanhoChave: 64, tamanhoSal: 16 } as const;

export const DURACAO_SESSAO_SEGUNDOS = 7 * 24 * 60 * 60;

function segredo(): Buffer {
  // NEXTAUTH_SECRET é aceito como alternativa por já existir em instalações
  // anteriores do projeto.
  const valor = process.env.SESSION_SECRET || process.env.NEXTAUTH_SECRET;

  if (!valor) {
    throw new Error(
      'SESSION_SECRET não definida. Gere uma com: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64\'))"',
    );
  }

  return Buffer.from(valor, 'utf8');
}

// ---------------------------------------------------------------------------
// Senhas
// ---------------------------------------------------------------------------

/** Deriva o hash da senha com scrypt e um sal aleatório por usuário. */
export async function hashSenha(senha: string): Promise<string> {
  const sal = randomBytes(SCRYPT.tamanhoSal);
  const derivada = await scrypt(senha.normalize('NFKC'), sal, SCRYPT.tamanhoChave, {
    N: SCRYPT.N,
    r: SCRYPT.r,
    p: SCRYPT.p,
  });

  return [
    'scrypt',
    SCRYPT.N,
    SCRYPT.r,
    SCRYPT.p,
    sal.toString('base64'),
    derivada.toString('base64'),
  ].join('$');
}

/** Compara a senha informada com o hash armazenado, em tempo constante. */
export async function verificarSenha(senha: string, armazenado: string): Promise<boolean> {
  const partes = armazenado.split('$');
  if (partes.length !== 6 || partes[0] !== 'scrypt') return false;

  const [, n, r, p, salB64, hashB64] = partes;
  const sal = Buffer.from(salB64, 'base64');
  const esperado = Buffer.from(hashB64, 'base64');

  let derivada: Buffer;
  try {
    derivada = await scrypt(senha.normalize('NFKC'), sal, esperado.length, {
      N: Number(n),
      r: Number(r),
      p: Number(p),
    });
  } catch {
    return false;
  }

  return derivada.length === esperado.length && timingSafeEqual(derivada, esperado);
}

// ---------------------------------------------------------------------------
// Token de sessão
// ---------------------------------------------------------------------------

export type SessaoPayload = {
  /** Id do usuário no MongoDB. */
  sub: string;
  nome: string;
  email: string;
  /** Expiração em segundos desde a época Unix. */
  exp: number;
};

function base64url(entrada: Buffer): string {
  return entrada.toString('base64url');
}

function assinar(payloadCodificado: string): string {
  return base64url(createHmac('sha256', segredo()).update(payloadCodificado).digest());
}

/**
 * Emite um token de sessão sem estado no formato `payload.assinatura`, assinado
 * com HMAC-SHA256. O payload é apenas codificado em base64url, não cifrado, por
 * isso carrega somente id, nome e e-mail — nunca a senha.
 */
export function criarToken(dados: Omit<SessaoPayload, 'exp'>): string {
  const payload: SessaoPayload = {
    ...dados,
    exp: Math.floor(Date.now() / 1000) + DURACAO_SESSAO_SEGUNDOS,
  };
  const codificado = base64url(Buffer.from(JSON.stringify(payload), 'utf8'));

  return `${codificado}.${assinar(codificado)}`;
}

/** Valida assinatura e expiração. Devolve `null` para qualquer token inválido. */
export function lerToken(token: string | undefined): SessaoPayload | null {
  if (!token) return null;

  const separador = token.lastIndexOf('.');
  if (separador <= 0) return null;

  const codificado = token.slice(0, separador);
  const assinatura = Buffer.from(token.slice(separador + 1), 'utf8');
  const esperada = Buffer.from(assinar(codificado), 'utf8');

  if (assinatura.length !== esperada.length || !timingSafeEqual(assinatura, esperada)) return null;

  let payload: SessaoPayload;
  try {
    payload = JSON.parse(Buffer.from(codificado, 'base64url').toString('utf8'));
  } catch {
    return null;
  }

  if (typeof payload?.sub !== 'string' || typeof payload?.exp !== 'number') return null;
  if (payload.exp * 1000 <= Date.now()) return null;

  return payload;
}
