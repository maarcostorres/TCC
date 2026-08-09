'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

type Props = {
  nome: string;
  email: string;
};

const ITENS = [
  { nome: 'Início', href: '/' },
  { nome: 'Estudar questões', href: '/estudo' },
  { nome: 'Mini provas', href: '/simulado' },
  { nome: 'Meu desempenho', href: '/stats' },
  { nome: 'Tutor IA', href: '/tutor' },
] as const;

function iniciais(nome: string): string {
  return nome
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0]?.toUpperCase() ?? '')
    .join('');
}

export default function Sidebar({ nome, email }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const [aberta, setAberta] = useState(false);
  const [saindo, setSaindo] = useState(false);

  // Navegar fecha o menu no mobile; sem isso o drawer ficaria por cima da
  // página recém-aberta.
  useEffect(() => setAberta(false), [pathname]);

  useEffect(() => {
    if (!aberta) return;

    const aoTeclar = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') setAberta(false);
    };
    document.addEventListener('keydown', aoTeclar);

    return () => document.removeEventListener('keydown', aoTeclar);
  }, [aberta]);

  async function sair() {
    setSaindo(true);
    try {
      await fetch('/api/auth/sair', { method: 'POST' });
      router.replace('/entrar');
      router.refresh();
    } finally {
      setSaindo(false);
    }
  }

  return (
    <>
      {/* Barra superior — só aparece abaixo de lg, onde a sidebar fica oculta */}
      <div className="lg:hidden fixed top-0 inset-x-0 h-16 z-40 flex items-center justify-between px-4 border-b border-[#27272a] bg-[#09090b]">
        <div className="flex items-center gap-2.5">
          <div className="w-5 h-5 bg-white rounded-sm" aria-hidden="true" />
          <span className="font-semibold text-white tracking-tight">NextEducation</span>
        </div>

        <button
          type="button"
          onClick={() => setAberta((valor) => !valor)}
          aria-expanded={aberta}
          aria-controls="menu-lateral"
          className="btn-secondary !px-3 !py-2 text-sm"
        >
          {aberta ? 'Fechar' : 'Menu'}
        </button>
      </div>

      {aberta && (
        <button
          type="button"
          aria-label="Fechar menu"
          onClick={() => setAberta(false)}
          className="lg:hidden fixed inset-0 z-40 bg-black/60"
        />
      )}

      <aside
        id="menu-lateral"
        className={`fixed left-0 top-0 bottom-0 w-64 border-r border-[#27272a] bg-[#09090b] z-50 flex flex-col transition-transform duration-200 lg:translate-x-0 ${
          aberta ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="h-16 lg:h-20 flex items-center px-6 lg:px-8 border-b border-[#27272a]">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 bg-white rounded-sm" aria-hidden="true" />
            <span className="font-semibold text-lg text-white tracking-tight">NextEducation</span>
          </div>
        </div>

        <nav aria-label="Navegação principal" className="flex flex-col gap-1 p-4 flex-1">
          <p className="px-4 text-[11px] font-semibold text-slate-500 uppercase tracking-widest mb-4 mt-4">
            Ciências Humanas
          </p>

          {ITENS.map((item) => {
            const ativo = pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={ativo ? 'page' : undefined}
                className={ativo ? 'nav-active' : 'nav-link'}
              >
                {item.nome}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-[#27272a] space-y-3">
          <div className="flex items-center gap-3 px-3">
            <div
              aria-hidden="true"
              className="w-8 h-8 shrink-0 rounded bg-slate-800 flex items-center justify-center text-xs font-semibold text-slate-300 border border-slate-700"
            >
              {iniciais(nome)}
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-medium text-slate-200 truncate">{nome}</span>
              <span className="text-[11px] text-slate-500 truncate">{email}</span>
            </div>
          </div>

          <button type="button" onClick={sair} disabled={saindo} className="btn-secondary w-full text-sm">
            {saindo ? 'Saindo...' : 'Sair'}
          </button>
        </div>
      </aside>
    </>
  );
}
