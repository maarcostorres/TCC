import { NextResponse, type NextRequest } from 'next/server';

/**
 * A partir do Next.js 16 o antigo `middleware.ts` chama-se `proxy.ts`.
 *
 * Aqui é feita apenas a checagem otimista recomendada pela documentação:
 * verifica-se a *presença* do cookie de sessão para redirecionar cedo, sem
 * validar a assinatura. A verificação real acontece em `lib/session.ts`, que é
 * consultada por toda página e rota que dependa do usuário autenticado.
 */
const COOKIE_SESSAO = 'nexteducation_session';

const ROTAS_PUBLICAS = ['/entrar', '/cadastro'];

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const temCookie = request.cookies.has(COOKIE_SESSAO);
  const ehPublica = ROTAS_PUBLICAS.some((rota) => pathname.startsWith(rota));

  if (!temCookie && !ehPublica) {
    const destino = new URL('/entrar', request.url);
    // Preserva para onde o aluno queria ir, para voltar depois do login.
    destino.searchParams.set('proximo', `${pathname}${search}`);

    return NextResponse.redirect(destino);
  }

  if (temCookie && ehPublica) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return NextResponse.next();
}

export const config = {
  // Exclui assets, o favicon e as rotas de autenticação, que precisam
  // responder sem sessão.
  matcher: ['/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\.svg$).*)'],
};
