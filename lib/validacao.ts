/** Validação dos dados de entrada das rotas de autenticação. */

export type Validado<T> = { ok: true; dados: T } | { ok: false; erro: string };

export const SENHA_TAMANHO_MINIMO = 8;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function texto(valor: unknown): string {
  return typeof valor === 'string' ? valor.trim() : '';
}

export type DadosLogin = { email: string; senha: string };
export type DadosCadastro = DadosLogin & { nome: string };

export function validarLogin(corpo: unknown): Validado<DadosLogin> {
  const dados = (corpo ?? {}) as Record<string, unknown>;
  const email = texto(dados.email).toLowerCase();
  const senha = typeof dados.senha === 'string' ? dados.senha : '';

  if (!EMAIL.test(email)) return { ok: false, erro: 'Informe um e-mail válido.' };
  if (!senha) return { ok: false, erro: 'Informe sua senha.' };

  return { ok: true, dados: { email, senha } };
}

export function validarCadastro(corpo: unknown): Validado<DadosCadastro> {
  const login = validarLogin(corpo);
  if (!login.ok) return login;

  const dados = (corpo ?? {}) as Record<string, unknown>;
  const nome = texto(dados.nome);

  if (nome.length < 2) return { ok: false, erro: 'Informe seu nome completo.' };
  if (nome.length > 80) return { ok: false, erro: 'Nome muito longo.' };
  if (login.dados.senha.length < SENHA_TAMANHO_MINIMO) {
    return { ok: false, erro: `A senha precisa ter ao menos ${SENHA_TAMANHO_MINIMO} caracteres.` };
  }

  return { ok: true, dados: { ...login.dados, nome } };
}
