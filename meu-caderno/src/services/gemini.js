import { GoogleGenerativeAI } from "@google/generative-ai";

// Recupera a chave da API do arquivo .env.local
const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

if (!apiKey) {
  console.error("⚠️ VITE_GEMINI_API_KEY não foi encontrada no .env.local!");
}

const genAI = new GoogleGenerativeAI(apiKey || "");

// Usamos o modelo gemini-1.5-flash (rápido e otimizado para texto)
const model = genAI.getGenerativeModel({ model: "gemini-3.6-flash" });

/**
 * 1. Gerar Resumo Inteligente do texto da aula
 */
export const generateSummary = async (text) => {
  try {
    const prompt = `Você é um assistente de estudos. Crie um resumo claro, organizado e com marcadores (bullet points) do seguinte texto acadêmico/aula:\n\n${text}`;
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error("Erro ao gerar resumo no Gemini:", error);
    throw error;
  }
};

/**
 * 2. Gerar Flashcards / Perguntas de Fixação
 */
export const generateFlashcards = async (text) => {
  try {
    const prompt = `Com base no conteúdo desta aula, crie 3 a 5 perguntas de fixação com suas respectivas respostas para estudo ativo.
    Retorne a resposta estritamente em formato JSON válido, como no exemplo abaixo, sem textos extras:
    [
      { "question": "Pergunta 1?", "answer": "Resposta 1" },
      { "question": "Pergunta 2?", "answer": "Resposta 2" }
    ]
    
    Texto da aula:\n${text}`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const rawText = response.text().replace(/```json|```/g, "").trim();
    return JSON.parse(rawText);
  } catch (error) {
    console.error("Erro ao gerar flashcards no Gemini:", error);
    throw error;
  }
};

/**
 * 3. Melhorar e Organizar a Formatação do Texto
 */
export const improveFormatting = async (text) => {
  try {
    const prompt = `Reescreva o texto abaixo corrigindo erros ortográficos, organizando os parágrafos e destacando termos importantes em negrito, mantendo o significado original intacto:\n\n${text}`;
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error("Erro ao melhorar texto no Gemini:", error);
    throw error;
  }
};