import Groq from "groq-sdk";

const apiKey = process.env.GROQ_API_KEY || "";
const isClientReady = apiKey.startsWith("gsk_");

const client = isClientReady ? new Groq({ apiKey }) : null;

const MODEL = "llama-3.3-70b-versatile";

// Função para o chat livre do Tutor IA
export async function getTutorResponse(userMessage: string) {
  if (!isClientReady) {
    return {
      message: "[Modo demonstração] Insira a chave GROQ_API_KEY no .env.local para ativar o Tutor IA real.",
      isMock: true,
    };
  }

  try {
    const completion = await client!.chat.completions.create({
      model: MODEL,
      messages: [
        {
          role: "system",
          content: "Você é um tutor educacional especialista em Ciências Humanas para o ENEM brasileiro. Responda sempre em português, de forma clara, didática e objetiva. Foque em História, Geografia, Sociologia e Filosofia conforme a matriz do ENEM.",
        },
        {
          role: "user",
          content: userMessage,
        },
      ],
      max_tokens: 1024,
      temperature: 0.7,
    });

    const text = completion.choices[0]?.message?.content || "Sem resposta gerada.";
    return { message: text, isMock: false };
  } catch (error) {
    console.error("Groq Chat Error:", error);
    return {
      message: "Falha na comunicação com o servidor de IA. Tente novamente.",
      isMock: true,
    };
  }
}

export async function getPedagogicalFeedback(question: any, userChoice: string) {
  if (!isClientReady) {
    const isCorrect = userChoice === question.label;
    const simulatedResponse = isCorrect
      ? "A análise heurística do enunciado confirma a veracidade da sua submissão. A inferência lógica entre as fontes textuais e a alternativa selecionada demonstra correlação profunda com os pressupostos epistemológicos cobrados na Matriz de Referência.\n\n[Modo demonstração — insira a chave GROQ_API_KEY no .env.local para ativar a IA real.]"
      : "O sistema detectou uma inconsistência analítica. A alternativa escolhida consiste em um distrator estruturado, comum neste eixo temático. Revise o conceito central abordado no enunciado com foco na interpretação crítica da fonte historiográfica ou geográfica.\n\n[Modo demonstração — insira a chave GROQ_API_KEY no .env.local para ativar a IA real.]";

    return { message: simulatedResponse, isMock: true };
  }

  const alternatives = (question.alternatives || []).join(", ");
  const description = (question.description || [])[0] || "Sem descrição de imagem";

  const userMessage = [
    "Você é um tutor especialista em Ciências Humanas para o ENEM.",
    "Analise a seguinte questão e a escolha do aluno e forneça um feedback pedagógico detalhado em português.",
    "",
    "QUESTÃO: " + question.question,
    "CONTEXTO/IMAGEM: " + description,
    "ALTERNATIVAS: " + alternatives,
    "GABARITO CORRETO: " + question.label,
    "RESPOSTA DO ALUNO: " + userChoice,
    "",
    "Regras do feedback:",
    "1. Se o aluno acertou: valide o conhecimento e acrescente contexto histórico ou geográfico relevante.",
    "2. Se o aluno errou: explique por que a alternativa dele é um distrator e ensine o conceito correto de forma clara.",
    "3. Seja didático, direto e encorajador.",
    "4. Limite a 3 parágrafos curtos.",
  ].join("\n");

  try {
    const completion = await client!.chat.completions.create({
      model: MODEL,
      messages: [{ role: "user", content: userMessage }],
      max_tokens: 512,
      temperature: 0.7,
    });

    const text = completion.choices[0]?.message?.content || "Sem resposta gerada.";
    return { message: text, isMock: false };
  } catch (error) {
    console.error("Groq API Error:", error);
    return {
      message: "Falha na comunicação com o servidor de IA. Verifique a chave GROQ_API_KEY e tente novamente.",
      isMock: true,
    };
  }
}
