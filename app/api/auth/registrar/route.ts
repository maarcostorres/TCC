import { NextResponse } from 'next/server';
import { usersCollection } from '@/lib/db';
import { hashSenha } from '@/lib/auth';
import { abrirSessao } from '@/lib/session';
import { validarCadastro } from '@/lib/validacao';

export async function POST(request: Request) {
  try {
    const corpo = await request.json().catch(() => null);
    const validacao = validarCadastro(corpo);

    if (!validacao.ok) {
      return NextResponse.json({ success: false, error: validacao.erro }, { status: 400 });
    }

    const { nome, email, senha } = validacao.dados;
    const users = await usersCollection();

    if (await users.findOne({ email })) {
      return NextResponse.json(
        { success: false, error: 'Já existe uma conta com este e-mail.' },
        { status: 409 },
      );
    }

    const resultado = await users.insertOne({
      nome,
      email,
      senhaHash: await hashSenha(senha),
      criadoEm: new Date(),
    });

    await abrirSessao({ sub: resultado.insertedId.toString(), nome, email });

    return NextResponse.json({ success: true, usuario: { nome, email } }, { status: 201 });
  } catch (erro) {
    // O índice único em `email` transforma um cadastro simultâneo em erro 11000.
    if (typeof erro === 'object' && erro !== null && 'code' in erro && erro.code === 11000) {
      return NextResponse.json(
        { success: false, error: 'Já existe uma conta com este e-mail.' },
        { status: 409 },
      );
    }

    console.error('Falha no cadastro:', erro);
    return NextResponse.json(
      { success: false, error: 'Não foi possível concluir o cadastro.' },
      { status: 500 },
    );
  }
}
