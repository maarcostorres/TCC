import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const examYear = searchParams.get('year');
    const limit = parseInt(searchParams.get('limit') || '10');
    
    const client = await clientPromise;
    const db = client.db('enem_benchmark');
    const collection = db.collection('questions');

    const query: any = {};
    if (examYear) {
      query.exam = examYear;
    }

    // Buscar questões aleatórias ou com filtros
    const questions = await collection
      .aggregate([
        { $match: query },
        { $sample: { size: limit } }
      ])
      .toArray();

    return NextResponse.json({
      success: true,
      count: questions.length,
      data: questions
    });

  } catch (error: any) {
    console.error('API Error Fetching Questions:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}
