import { NextResponse } from 'next/server';
import { encerrarSessao } from '@/lib/session';

export async function POST() {
  await encerrarSessao();

  return NextResponse.json({ success: true });
}
