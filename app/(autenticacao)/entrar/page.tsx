import type { Metadata } from 'next';
import FormularioAutenticacao from '@/components/FormularioAutenticacao';
import { rotaInternaSegura } from '@/lib/rotas';

export const metadata: Metadata = { title: 'Entrar | NextEducation' };

export default async function EntrarPage({
  searchParams,
}: {
  searchParams: Promise<{ proximo?: string }>;
}) {
  const { proximo } = await searchParams;

  return <FormularioAutenticacao modo="entrar" proximo={rotaInternaSegura(proximo)} />;
}
