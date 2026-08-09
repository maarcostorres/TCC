import 'server-only';
import { cookies } from 'next/headers';
import { cache } from 'react';
import {
  DURACAO_SESSAO_SEGUNDOS,
  criarToken,
  lerToken,
  type SessaoPayload,
} from '@/lib/auth';

export const COOKIE_SESSAO = 'nexteducation_session';

/**
 * Grava o cookie de sessão. Só pode ser chamada de um Route Handler ou Server
 * Function — o Next não permite escrever cookies durante a renderização.
 */
export async function abrirSessao(dados: Omit<SessaoPayload, 'exp'>): Promise<void> {
  const cookieStore = await cookies();

  cookieStore.set(COOKIE_SESSAO, criarToken(dados), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: DURACAO_SESSAO_SEGUNDOS,
  });
}

export async function encerrarSessao(): Promise<void> {
  (await cookies()).delete(COOKIE_SESSAO);
}

/**
 * Ponto único de verificação da sessão — a camada de acesso a dados que o guia
 * de autenticação do Next.js recomenda. O `proxy.ts` faz apenas uma checagem
 * otimista de presença do cookie; é aqui que a assinatura é conferida.
 *
 * Memoizada por requisição com `cache()` para que várias chamadas na mesma
 * árvore de renderização não repitam a verificação do HMAC.
 */
export const getSessao = cache(async (): Promise<SessaoPayload | null> => {
  const token = (await cookies()).get(COOKIE_SESSAO)?.value;

  return lerToken(token);
});

/** Igual a `getSessao`, mas falha em vez de devolver `null`. */
export async function exigirSessao(): Promise<SessaoPayload> {
  const sessao = await getSessao();
  if (!sessao) throw new Error('Não autenticado.');

  return sessao;
}
