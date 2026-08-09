import { NextResponse } from 'next/server';
import { usersCollection } from '@/lib/db';
import { verificarSenha } from '@/lib/auth';
import { abrirSessao } from '@/lib/session';
import { validarLogin } from '@/lib/validacao';

/** Mensagem única para e-mail inexistente e senha errada, para não revelar
 *  quais e-mails estão cadastrados. */
const CREDENCIAL_INVALIDA = 'E-mail ou senha incorretos.';

export async function POST(request: Request) {
  try {
    const corpo = await request.json().catch(() => null);
    const validacao = validarLogin(corpo);

    if (!validacao.ok) {
      return NextResponse.json({ success: false, error: validacao.erro }, { status: 400 });
    }

    const { email, senha } = validacao.dados;
    const usuario = await (await usersCollection()).findOne({ email });

    if (!usuario || !(await verificarSenha(senha, usuario.senhaHash))) {
      return NextResponse.json({ success: false, error: CREDENCIAL_INVALIDA }, { status: 401 });
    }

    await abrirSessao({
      sub: usuario._id.toString(),
      nome: usuario.nome,
      email: usuario.email,
    });

    return NextResponse.json({
      success: true,
      usuario: { nome: usuario.nome, email: usuario.email },
    });
  } catch (erro) {
    console.error('Falha no login:', erro);
    return NextResponse.json(
      { success: false, error: 'Não foi possível entrar agora.' },
      { status: 500 },
    );
  }
}
