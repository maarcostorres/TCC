/**
 * Baixa os datasets de questões que a plataforma importa e grava-os em `data/`.
 *
 * Os arquivos ficam versionados no repositório para que a sincronização não
 * dependa de rede, mas este script existe para que a origem deles seja
 * auditável: qualquer pessoa pode reexecutá-lo e obter os mesmos arquivos.
 *
 *   npm run datasets
 *
 * Fontes:
 *   - ENEM Challenge  (ENEM 2009-2017, 2022-2023)  eduagarcia/enem_challenge
 *   - BLUEX           (Fuvest/USP e Unicamp 2018-2025)  portuguese-benchmark-datasets/BLUEX
 *
 * O ENEM-Benchmark da Maritaca (2022-2024), citado no artigo, já está em
 * `data/2022.jsonl`, `2023.jsonl` e `2024.jsonl` e não é tocado aqui.
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';

const API = 'https://datasets-server.huggingface.co/rows';
const PAGINA = 100;

type Linha = Record<string, unknown>;

const espera = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * A API pública da HuggingFace limita a taxa de requisições e responde 429 no
 * meio de um download longo. Reexecutar o script inteiro por causa disso
 * desperdiça as páginas já baixadas, então cada página é reservada com recuo
 * exponencial.
 */
async function buscarComRetentativa(url: string, tentativas = 8): Promise<Response> {
  for (let tentativa = 1; ; tentativa++) {
    const resposta = await fetch(url);
    if (resposta.ok) return resposta;

    const recuperavel = resposta.status === 429 || resposta.status >= 500;
    if (!recuperavel || tentativa >= tentativas) return resposta;

    const segundos = 2 ** tentativa;
    process.stdout.write(` [HTTP ${resposta.status}, aguardando ${segundos}s]`);
    await espera(segundos * 1_000);
  }
}

async function baixarSplit(dataset: string, split: string): Promise<Linha[]> {
  const linhas: Linha[] = [];

  for (let offset = 0; ; offset += PAGINA) {
    const url = `${API}?dataset=${encodeURIComponent(dataset)}&config=default&split=${split}&offset=${offset}&length=${PAGINA}`;
    const resposta = await buscarComRetentativa(url);

    if (!resposta.ok) {
      throw new Error(`${dataset}: HTTP ${resposta.status} em offset ${offset}`);
    }

    const corpo = (await resposta.json()) as {
      rows: { row: Linha }[];
      num_rows_total: number;
    };

    linhas.push(...corpo.rows.map((item) => item.row));
    process.stdout.write(`\r  ${dataset}: ${linhas.length}/${corpo.num_rows_total}`);

    if (linhas.length >= corpo.num_rows_total) break;

    // Pausa entre páginas: pedir as 15 páginas em sequência dispara o limite de
    // taxa da API já na sexta, e esperar depois do 429 sai mais caro que evitá-lo.
    await espera(1_500);
  }

  process.stdout.write('\n');

  return linhas;
}

/**
 * O BLUEX embute as imagens da questão como JPEG em base64. Só o subconjunto de
 * Ciências Humanas passa de 40 MB por causa disso, e a plataforma nem exibe
 * imagem — ela usa as legendas textuais. Os bytes são descartados aqui.
 */
function semBytesDeImagem(linha: Linha): Linha {
  const copia = { ...linha };
  delete copia.associated_images;

  return copia;
}

async function gravarJsonl(nome: string, linhas: Linha[]): Promise<void> {
  const destino = path.join(process.cwd(), 'data', nome);
  const conteudo = linhas.map((linha) => JSON.stringify(linha)).join('\n');

  await fs.writeFile(destino, `${conteudo}\n`, 'utf8');

  const kb = Math.round(Buffer.byteLength(conteudo) / 1024);
  console.log(`  gravado data/${nome} — ${linhas.length} registros, ${kb} KB`);
}

async function main(): Promise<void> {
  console.log('Baixando ENEM Challenge...');
  const enem = await baixarSplit('eduagarcia/enem_challenge', 'train');
  await gravarJsonl('enem-challenge.jsonl', enem);

  console.log('Baixando BLUEX...');
  const bluex = await baixarSplit('portuguese-benchmark-datasets/BLUEX', 'questions');
  await gravarJsonl('bluex.jsonl', bluex.map(semBytesDeImagem));

  console.log('\nPronto. Rode a sincronização na plataforma para carregar no MongoDB.');
}

main().catch((erro: unknown) => {
  console.error('\nFalha ao baixar os datasets:', erro instanceof Error ? erro.message : erro);
  process.exit(1);
});
