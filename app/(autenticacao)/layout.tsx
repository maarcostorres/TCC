export default function AutenticacaoLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <main id="conteudo" className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md fade-in">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-6 h-6 bg-white rounded-sm" aria-hidden="true" />
          <span className="font-semibold text-lg text-white tracking-tight">NextEducation</span>
        </div>
        {children}
      </div>
    </main>
  );
}
