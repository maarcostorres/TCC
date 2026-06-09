import { NextResponse } from 'next/server';
import { getPedagogicalFeedback } from '@/lib/groq';

export async function POST(request: Request) {
  try {
    const { question, userChoice } = await request.json();

    if (!question || !userChoice) {
      return NextResponse.json({ error: "Missing data" }, { status: 400 });
    }

    const feedback = await getPedagogicalFeedback(question, userChoice);

    return NextResponse.json({
      success: true,
      feedback: feedback.message,
      isMock: feedback.isMock
    });

  } catch (error: any) {
    console.error('AI API Route Error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}
