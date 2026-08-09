import type { Metadata, Viewport } from 'next';
import './main.css';

export const metadata: Metadata = {
  title: 'NextEducation — Ciências Humanas para o ENEM',
  description:
    'Plataforma de avaliação formativa que corrige questões de Ciências Humanas do ENEM e explica cada resposta com apoio de inteligência artificial.',
};

export const viewport: Viewport = {
  themeColor: '#09090b',
  colorScheme: 'dark',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body className="antialiased min-h-screen selection:bg-blue-600/30 selection:text-white">
        <a href="#conteudo" className="skip-link">
          Pular para o conteúdo
        </a>
        {children}
      </body>
    </html>
  );
}
