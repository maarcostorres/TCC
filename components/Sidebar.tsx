'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const Sidebar = () => {
  const pathname = usePathname();

  const menuItems = [
    { name: 'Dashboard', href: '/' },
    { name: 'Módulo de Estudos', href: '/estudo' },
    { name: 'Simulados de Precisão', href: '/simulado' },
    { name: 'Performance & Dados', href: '/stats' },
    { name: 'Base de Conhecimento IA', href: '/tutor' },
  ];

  return (
    <aside className="fixed left-0 top-0 bottom-0 w-64 border-r border-[#27272a] bg-[#09090b] z-50 flex flex-col">
      {/* Branding */}
      <div className="h-20 flex items-center px-8 border-b border-[#27272a]">
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 bg-white rounded-sm"></div>
          <span className="font-semibold text-lg text-white tracking-tight">NextEducation</span>
        </div>
      </div>

      {/* Menu Principal */}
      <nav className="flex flex-col gap-1 p-4 flex-1">
        <p className="px-4 text-[11px] font-semibold text-slate-500 uppercase tracking-widest mb-4 mt-4">Navegação B2B</p>
        {menuItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link 
              key={item.href} 
              href={item.href}
              className={isActive ? "nav-active" : "nav-link"}
            >
              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>

      {/* User Session Wrapper */}
      <div className="p-4 border-t border-[#27272a]">
        <div className="flex items-center gap-3 p-3 rounded-md hover:bg-white/5 transition-colors cursor-pointer">
          <div className="w-8 h-8 rounded bg-slate-800 flex items-center justify-center text-xs font-semibold text-slate-300 border border-slate-700">
            MT
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-medium text-slate-200">Acesso Aluno</span>
            <span className="text-[11px] text-slate-500">Ciências Humanas</span>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
