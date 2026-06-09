import type { Metadata } from "next";
import "./main.css";
import Sidebar from "@/components/Sidebar";

export const metadata: Metadata = {
  title: "NextEducation | Plataforma B2B",
  description: "Plataforma Educacional Inteligente baseada em dados e IA.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className="antialiased min-h-screen flex selection:bg-blue-600/30 selection:text-white">
        {/* Navegação Fixa - Minimalista */}
        <Sidebar />

        {/* Área de Conteúdo Principal */}
        <main className="flex-1 ml-64 relative z-10 w-full min-h-screen">
            <div className="max-w-6xl mx-auto w-full px-12 py-10 fade-in">
              {children}
            </div>
        </main>
      </body>
    </html>
  );
}
