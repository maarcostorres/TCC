import { NextRequest, NextResponse } from "next/server";
import { getTutorResponse } from "@/lib/groq";

export async function POST(request: NextRequest) {
  try {
    const { message } = await request.json();

    if (!message || typeof message !== "string") {
      return NextResponse.json({ success: false, error: "Mensagem inválida." }, { status: 400 });
    }

    const result = await getTutorResponse(message);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("Chat route error:", error);
    return NextResponse.json({ success: false, error: "Erro interno no servidor." }, { status: 500 });
  }
}
