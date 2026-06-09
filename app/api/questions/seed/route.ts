import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    const client = await clientPromise;
    const db = client.db('enem_benchmark');
    const collection = db.collection('questions');

    const dataDir = path.join(process.cwd(), 'data');
    const files = ['2022.jsonl', '2023.jsonl', '2024.jsonl'];
    
    let totalImported = 0;

    for (const fileName of files) {
      const filePath = path.join(dataDir, fileName);
      if (!fs.existsSync(filePath)) continue;

      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.split('\n').filter(line => line.trim() !== '');
      
      const documents = lines.map(line => {
        try {
          const parsed = JSON.parse(line);
          return {
            ...parsed,
            importedAt: new Date(),
            sourceFile: fileName
          };
        } catch (e) {
          console.error(`Error parsing line in ${fileName}:`, e);
          return null;
        }
      }).filter(doc => doc !== null);

      if (documents.length > 0) {
        // Use upsert to avoid duplicates by 'id'
        for (const doc of documents as any[]) {
          await collection.updateOne(
            { id: doc.id },
            { $set: doc },
            { upsert: true }
          );
        }
        totalImported += documents.length;
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: `${totalImported} questões processadas com sucesso no banco de dados.`,
      details: "As questões foram sincronizadas usando o campo 'id' como chave única."
    });

  } catch (error: any) {
    console.error('--- ERRO DETECTADO NO SEED ---');
    console.error('Mensagem:', error.message);
    if (error.code) console.error('Código do Erro:', error.code);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}
