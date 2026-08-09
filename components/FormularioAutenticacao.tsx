'use client';

import { useState, useId } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

type Modo = 'entrar' | 'cadastro';

type Props = {
  modo: Modo;
  /** Rota para onde voltar depois de autenticar. */
  proximo: string;
};

const TEXTOS = {
  entrar: {
    titulo: 'Entrar na plataforma',
    subtitulo: 'Acesse para continuar seus estudos de Ciências Humanas.',
    acao: 'Entrar',
    carregando: 'Entrando...',
    rota: '/api/auth/entrar',
    alternativa: { texto: 'Ainda não tem conta?', link: '/cadastro', rotulo: 'Criar conta' },
  },
  cadastro: {
    titulo: 'Criar sua conta',
    subtitulo: 'Leva menos de um minuto e seu histórico fica salvo.',
    acao: 'Criar conta',
    carregando: 'Criando...',
    rota: '/api/auth/registrar',
    alternativa: { texto: 'Já tem conta?', link: '/entrar', rotulo: 'Entrar' },
  },
} as const;

export default function FormularioAutenticacao({ modo, proximo }: Props) {
  const router = useRouter();
  const idBase = useId();
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const t = TEXTOS[modo];

  async function enviar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (enviando) return;

    setEnviando(true);
    setErro(null);

    const dados = Object.fromEntries(new FormData(evento.currentTarget));

    try {
      const resposta = await fetch(t.rota, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dados),
      });
      const corpo = await resposta.json();

      if (!corpo.success) {
        setErro(corpo.error ?? 'Não foi possível continuar.');
        return;
      }

      router.replace(proximo);
      // Descarta o cache do roteador para o layout autenticado ser renderizado
      // de novo já com a sessão recém-criada.
      router.refresh();
    } catch {
      setErro('Falha de conexão com o servidor. Verifique sua internet.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="card-solid p-8">
      <h1 className="text-2xl font-semibold text-white tracking-tight">{t.titulo}</h1>
      <p className="text-sm text-slate-400 mt-2 mb-8">{t.subtitulo}</p>

      <form onSubmit={enviar} className="space-y-5">
        {modo === 'cadastro' && (
          <Campo
            id={`${idBase}-nome`}
            name="nome"
            label="Nome completo"
            type="text"
            autoComplete="name"
            required
          />
        )}

        <Campo
          id={`${idBase}-email`}
          name="email"
          label="E-mail"
          type="email"
          autoComplete="email"
          required
        />

        <Campo
          id={`${idBase}-senha`}
          name="senha"
          label="Senha"
          type="password"
          autoComplete={modo === 'cadastro' ? 'new-password' : 'current-password'}
          required
          dica={modo === 'cadastro' ? 'Mínimo de 8 caracteres.' : undefined}
        />

        <p role="alert" aria-live="polite" className="text-sm text-red-400 min-h-5">
          {erro}
        </p>

        <button type="submit" disabled={enviando} className="btn-primary w-full">
          {enviando ? t.carregando : t.acao}
        </button>
      </form>

      <p className="text-sm text-slate-400 mt-6 text-center">
        {t.alternativa.texto}{' '}
        <Link href={t.alternativa.link} className="text-white font-medium underline underline-offset-4">
          {t.alternativa.rotulo}
        </Link>
      </p>
    </div>
  );
}

type CampoProps = {
  id: string;
  name: string;
  label: string;
  type: string;
  autoComplete: string;
  required?: boolean;
  dica?: string;
};

function Campo({ id, name, label, type, autoComplete, required, dica }: CampoProps) {
  const idDica = `${id}-dica`;

  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-sm font-medium text-slate-300">
        {label}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        autoComplete={autoComplete}
        required={required}
        aria-describedby={dica ? idDica : undefined}
        className="campo w-full"
      />
      {dica && (
        <p id={idDica} className="text-xs text-slate-500">
          {dica}
        </p>
      )}
    </div>
  );
}
