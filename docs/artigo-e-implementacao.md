# Artigo × implementação

Mapeia cada afirmação do artigo de TCC para o ponto do código que a sustenta. Serve para a defesa
do trabalho e para deixar registrado o que mudou depois da entrega à banca.

## Objetivos específicos

| Objetivo (seção 1.3.2 do artigo) | Onde está |
| --- | --- |
| Levantar requisitos funcionais e não funcionais | Tabela 1 do artigo; os RNF verificáveis estão cobertos abaixo |
| Selecionar, tratar e organizar questões de Ciências Humanas | [`lib/enem.ts`](../lib/enem.ts) e [`app/api/questions/seed/route.ts`](../app/api/questions/seed/route.ts) |
| Desenvolver a plataforma com autenticação, atividades, mini provas, dashboard e tutor IA | `app/(autenticacao)/`, `app/(plataforma)/` |
| Integrar a plataforma a um modelo via API Groq | [`lib/groq.ts`](../lib/groq.ts) |
| Gerar feedback didático a partir da resposta e do gabarito | [`app/api/ai/feedback/route.ts`](../app/api/ai/feedback/route.ts) |
| Avaliar preliminarmente estabilidade técnica e qualidade dos feedbacks | [`scripts/avaliacao-etapa5.mts`](../scripts/avaliacao-etapa5.mts) |

## Etapas da metodologia

### Etapa 2 — Curadoria de dados

> "O foco foi estrito em itens da área de Ciências Humanas."

O dataset ENEM-Benchmark não tem campo de área, mas a posição da questão no caderno é fixa dentro
de uma mesma década. A função `areaDaQuestao` em [`lib/enem.ts`](../lib/enem.ts) deriva a área do
número da questão, e a sincronização importa apenas a faixa de Humanas: **45 questões por edição,
135 no ciclo 2022–2024** — que é o corpus descrito no artigo e o que foi avaliado na Etapa 5.

A chave de upsert é `questionKey` (`"2023-052"`). Isso importa porque os três arquivos JSONL
numeram suas questões de `questao_01` a `questao_180` — uma chave baseada apenas no campo `id` do
dataset faz cada edição sobrescrever a anterior, deixando só 180 documentos no banco.

#### Ampliação da base após a entrega

> "recomenda-se realizar uma avaliação empírica com estudantes" e "testes sistemáticos com maior
> quantidade de questões" — Conclusão

A base foi ampliada de 135 para **903 questões de Ciências Humanas**, todas oficiais e com gabarito
oficial, somando o [ENEM Challenge](https://huggingface.co/datasets/eduagarcia/enem_challenge)
(ENEM 2009–2017, 381 questões) e o [BLUEX](https://github.com/portuguese-benchmark-datasets/BLUEX)
(Fuvest/USP e Unicamp 2018–2025, 387 questões) ao ENEM-Benchmark.

O que dizer na defesa, se perguntarem: **o artigo descreve o ENEM-Benchmark, e ele continua sendo a
fonte do que foi avaliado.** As outras duas não substituem nada — atendem ao trabalho futuro que a
própria conclusão pede. O BLUEX extrapola o escopo "ENEM" do título; foi uma decisão consciente de
ampliar a plataforma além do que o artigo relata.

Dois cuidados de curadoria que a ampliação exigiu, ambos verificados contra os dados e não
deduzidos de documentação:

1. **A faixa de Humanas mudou em 2017.** Em 2010–2016 ela era 001–045, não 046–090. Importar sem
   verificar teria trazido Física, Química e Biologia rotuladas como Ciências Humanas em sete das
   nove edições históricas.
2. **2016 teve duas aplicações** (regular e reaplicação), que reiniciam a numeração das questões.
   A chave do ENEM passou a usar `exam_id` em vez do ano; sem isso a reaplicação sobrescrevia 31
   questões da prova regular — o mesmo defeito nº 1 desta lista, em roupa nova.

### Etapa 3 — Desenvolvimento da plataforma

A arquitetura da Figura 1 corresponde às camadas do código:

| Camada da figura | No código |
| --- | --- |
| Cliente/Frontend | Componentes em `app/(plataforma)/` e `components/` |
| Requisições HTTP | `fetch` das telas para as rotas em `app/api/` |
| Servidor/Backend | Route Handlers em `app/api/` e `proxy.ts` |
| Banco de Dados Externo | MongoDB, via [`lib/db.ts`](../lib/db.ts) e [`lib/mongodb.ts`](../lib/mongodb.ts) |
| Serviços Externos de IA / Inferência por IA | API Groq, via [`lib/groq.ts`](../lib/groq.ts) |

### Etapa 4 — Integração com IA

Os "prompts pedagógicos especializados" citados no artigo estão em `SISTEMA_FEEDBACK` e
`montarPrompt`, em [`lib/groq.ts`](../lib/groq.ts). O prompt recebe enunciado, descrição da imagem
(quando existe), alternativas, gabarito e resposta do aluno, e ramifica em dois caminhos: validar o
acerto com aprofundamento, ou explicar o distrator e depois o gabarito.

### Etapa 5 — Avaliação preliminar

`npm run avaliacao -- --n 20 --semente 42` reproduz o protocolo: sorteia as questões, simula
respostas, gera os feedbacks, mede latência e tokens, e exporta um CSV com as quatro colunas da
rubrica (Tabela 2) prontas para preenchimento.

Com `--semente`, a amostra e as respostas simuladas são idênticas entre execuções — o que permite
que outra pessoa refaça exatamente a mesma avaliação.

## Requisitos não funcionais

| RNF (Tabela 1) | Como é atendido |
| --- | --- |
| Interface responsiva e acessível | Barra lateral vira gaveta abaixo de `lg`; alternativas com `role="radio"` e rótulo acessível; `aria-live` no feedback; foco visível; link "pular para o conteúdo"; `prefers-reduced-motion` |
| Baixa latência na resposta do Tutor IA | Toda chamada ao modelo devolve `latenciaMs` ([`lib/groq.ts`](../lib/groq.ts)); o valor é gravado na tentativa e agregado em média e p95 na tela `/stats` |
| Arquitetura escalável baseada na nuvem | Cliente MongoDB reaproveitado entre invocações; `bulkWrite` na sincronização; índices em `lib/db.ts` |
| Persistência segura em banco NoSQL | Senha com scrypt e sal por usuário; sessão assinada com HMAC-SHA256 em cookie `httpOnly`; toda rota de dados exige sessão |

## O que mudou depois da entrega à banca

Correções de defeitos que contradiziam o texto do artigo:

1. **Colisão de chave no seed.** O upsert por `id` fazia 2024 sobrescrever 2023 e 2022 — o banco
   ficava com 180 questões, não com o ciclo completo. Agora a chave é composta.
2. **Ausência de curadoria por área.** Nenhum filtro era aplicado, então o aluno recebia questões
   de Matemática e Linguagens, apesar de o artigo afirmar foco estrito em Ciências Humanas.
3. **Autenticação inexistente.** O artigo cita o módulo no resumo, nos objetivos e na conclusão;
   não havia nada implementado.
4. **Dashboard com dados fictícios.** A tela de desempenho exibia números escritos no código
   (`142`, `78%`) e um gráfico desativado.
5. **Nenhuma resposta era persistida**, apesar de o artigo prometer análise de desempenho e
   gravação do progresso.
6. **Latência nunca medida**, embora fosse requisito não funcional e resultado declarado.
7. **Interface não responsiva.** A barra lateral fixa com `ml-64` inviabilizava o uso em celular.
8. **Gabarito exposto ao cliente.** A resposta certa era enviada junto do enunciado e a correção
   acontecia no navegador.
9. **Credenciais versionadas.** `test-db.js` continha a URI do MongoDB com usuário e senha em texto
   claro, e estava no repositório público. O arquivo foi removido, mas permanece no histórico do
   Git — a credencial só deixa de valer quando a senha é trocada no Atlas, conforme
   [`deploy-vercel.md`](deploy-vercel.md).
10. **Sincronização sem autenticação.** `POST /api/questions/seed` era a única rota de dados que não
    chamava `getSessao()`. Dependia apenas do `proxy.ts`, que responde a um POST com
    redirecionamento — o que não protege a rota. Com a plataforma publicada, qualquer pessoa poderia
    disparar a reimportação das três edições.

Itens do artigo que permanecem como trabalho futuro, sem implementação: notificações em
aplicativos de mensagens e o motor de repetição espaçada, ambos citados apenas na introdução e na
justificativa.
