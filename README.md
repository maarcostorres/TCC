# NextEducation

Plataforma web de avaliação formativa para o estudo de **Ciências Humanas** no ENEM. O aluno
resolve questões oficiais, recebe uma explicação didática gerada por um modelo de linguagem e
acompanha a evolução do próprio desempenho.

Artefato do Trabalho de Conclusão de Curso *Sistema de Tutoria Baseado em IA Educativa para
Avaliação Formativa em Ciências Humanas* (Universidade Vila Velha), de Luis Henrique Gomes Zortea
e Marcos Vinicius Silva Torres.

## Como funciona

| Módulo | Rota | O que faz |
| --- | --- | --- |
| Autenticação | `/entrar`, `/cadastro` | Conta com senha (scrypt) e sessão assinada em cookie `httpOnly` |
| Início | `/` | Painel com questões disponíveis, respondidas e aproveitamento |
| Estudos | `/estudo` | Uma questão por vez, com correção imediata e explicação da IA |
| Mini provas | `/simulado` | Cinco questões cronometradas, com revisão item a item ao final |
| Desempenho | `/stats` | Aproveitamento, evolução diária, acertos por edição e latência da IA |
| Tutor IA | `/tutor` | Conversa livre sobre História, Geografia, Filosofia e Sociologia |

## Requisitos

- Node.js 20.6 ou superior
- Um cluster MongoDB (Atlas ou local)
- Uma chave da [API Groq](https://console.groq.com) — opcional: sem ela a plataforma roda em modo
  demonstração, com feedback fixo no lugar da resposta do modelo

## Instalação

```bash
npm install
```

Copie `.env.example` para `.env.local` e preencha as três variáveis:

```bash
cp .env.example .env.local
```

- `MONGODB_URI` — string de conexão do cluster
- `GROQ_API_KEY` — chave da Groq (começa com `gsk_`)
- `SESSION_SECRET` — segredo para assinar a sessão. Gere um com:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Suba o servidor de desenvolvimento:

```bash
npm run dev
```

Crie uma conta em <http://localhost:3000/cadastro>, entre e clique em **Sincronizar agora** na tela
inicial para carregar as questões no MongoDB.

## Publicar na Vercel

O passo a passo está em [`docs/deploy-vercel.md`](docs/deploy-vercel.md): troca da credencial do
Atlas, liberação de rede, as três variáveis de ambiente e a verificação de que subiu funcionando.

## O banco de questões

As questões vêm do dataset [ENEM-Benchmark](https://huggingface.co/datasets/maritaca-ai/enem), da
Maritaca AI, nos arquivos `data/2022.jsonl`, `data/2023.jsonl` e `data/2024.jsonl` — 180 questões
por edição, na ordem oficial do caderno.

O dataset não traz a área do conhecimento de cada questão, mas a posição no caderno é fixa:

| Posição | Área |
| --- | --- |
| 001–045 | Linguagens, Códigos e suas Tecnologias |
| **046–090** | **Ciências Humanas e suas Tecnologias** |
| 091–135 | Ciências da Natureza e suas Tecnologias |
| 136–180 | Matemática e suas Tecnologias |

A sincronização (`POST /api/questions/seed`) importa apenas a faixa 046–090, o que dá **45 questões
por edição — 135 no ciclo 2022–2024**. As outras 405 são descartadas, e o resumo da resposta informa
quantas e por quê.

Cada questão é gravada com a chave `questionKey` no formato `"2023-052"`. O campo `id` do dataset
não serve como chave: os três arquivos numeram suas questões de `questao_01` a `questao_180`, de
modo que uma chave baseada só nele faria cada edição sobrescrever a anterior.

O gabarito nunca é enviado ao navegador junto do enunciado: `GET /api/questions` o omite, e a
correção acontece no servidor, em `POST /api/attempts`.

## Reproduzir a avaliação da Etapa 5

O artigo descreve uma avaliação preliminar com 20 questões, escala Likert de 1 a 5 e quatro
critérios. O script abaixo executa esse protocolo de ponta a ponta:

```bash
npm run avaliacao -- --n 20 --semente 42
```

Parâmetros:

- `--n` — quantidade de questões (padrão: 20)
- `--erros` — proporção de respostas simuladas erradas (padrão: 0.5)
- `--semente` — inteiro que torna a amostra reprodutível
- `--saida` — prefixo dos arquivos gerados

Ele grava dois arquivos em `resultados-avaliacao/`:

- **`.csv`** — uma linha por questão, com latência e tokens já preenchidos e as quatro colunas da
  rubrica em branco, para os avaliadores atribuírem as notas
- **`.json`** — o texto integral de cada feedback, que é o registro do que foi avaliado

## Estrutura

```
app/
  (autenticacao)/     entrar, cadastro — sem a barra lateral
  (plataforma)/       telas autenticadas, com barra lateral
  api/
    ai/               chat do tutor e geração de feedback
    attempts/         correção e registro das respostas
    auth/             registrar, entrar, sair
    questions/        consulta e sincronização do dataset
    stats/            métricas agregadas do estudante
components/           componentes de interface
lib/
  auth.ts             hash de senha (scrypt) e token de sessão (HMAC)
  db.ts               coleções e índices do MongoDB
  enem.ts             regras de domínio do ENEM e curadoria do dataset
  groq.ts             integração com a API Groq e os prompts pedagógicos
  session.ts          leitura e escrita da sessão (camada de acesso a dados)
proxy.ts              guarda de rota (era middleware.ts antes do Next.js 16)
scripts/              harness da avaliação da Etapa 5
```

## Tecnologias

Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, MongoDB e a API Groq com o modelo
Llama 3.3 70B.

A autenticação não usa biblioteca externa: o hash de senha e a assinatura da sessão são feitos com
o módulo `node:crypto`.
