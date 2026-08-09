import { redirect } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import { getSessao } from '@/lib/session';

/**
 * Layout das telas autenticadas. A verificação real da sessão acontece aqui —
 * o `proxy.ts` só faz a checagem otimista de presença do cookie, que sozinha
 * não prova que o token é válido.
 */
export default async function PlataformaLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const sessao = await getSessao();
  if (!sessao) redirect('/entrar');

  return (
    <div className="flex min-h-screen">
      <Sidebar nome={sessao.nome} email={sessao.email} />

      <main id="conteudo" className="flex-1 w-full min-w-0 lg:ml-64">
        <div className="max-w-6xl mx-auto w-full px-4 sm:px-8 lg:px-12 pt-20 lg:pt-10 pb-16 fade-in">
          {children}
        </div>
      </main>
    </div>
  );
}
