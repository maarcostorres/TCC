import type { Metadata } from 'next';
import FormularioAutenticacao from '@/components/FormularioAutenticacao';

export const metadata: Metadata = { title: 'Criar conta | NextEducation' };

export default function CadastroPage() {
  return <FormularioAutenticacao modo="cadastro" proximo="/" />;
}
