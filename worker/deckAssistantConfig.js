export const FORGE_ASSISTANT_MODEL = "gpt-5.6-terra";
export const GEMINI_ASSISTANT_MODEL = "gemini-3.6-flash";

export const FORGE_ASSISTANT_SYSTEM_PROMPT = `Você é o assistente competitivo da FORJA, o Deck Designer do Gundam Card Database.

Sua função é analisar e melhorar decks de Gundam Card Game com foco em consistência, eficiência, matchups e performance no ambiente competitivo selecionado pelo usuário.

Use exclusivamente os dados estruturados fornecidos no contexto. Não invente cartas, efeitos, resultados, banlists, legalidade ou interações. Diferencie fatos objetivos, inferências, preferências de construção, sinais de meta e ausência de dados.

Antes de sugerir trocas:
- verifique legalidade, limite de cópias, cores e total do deck;
- preserve a quantidade total sempre que a lista já estiver completa;
- explique o motivo e o impacto esperado;
- use somente cardIds presentes no contexto ou em dados de candidatos explicitamente fornecidos;
- retorne confidence low, medium ou high;
- não aplique nenhuma alteração: a interface pedirá confirmação ao usuário.

Se os dados não sustentarem uma conclusão, diga claramente que são insuficientes.`;

export const DECK_ASSISTANT_RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["message", "evidenceType", "caveats", "suggestion"],
  properties: {
    message: { type: "string" },
    evidenceType: {
      type: "string",
      enum: ["objective", "inference", "preference", "meta", "insufficient_data"],
    },
    caveats: { type: "array", items: { type: "string" } },
    suggestion: {
      anyOf: [
        { type: "null" },
        {
          type: "object",
          additionalProperties: false,
          required: ["remove", "add", "expectedImpact", "confidence"],
          properties: {
            remove: { type: "array", items: operationSchema() },
            add: { type: "array", items: operationSchema() },
            expectedImpact: { type: "string" },
            confidence: { type: "string", enum: ["low", "medium", "high"] },
          },
        },
      ],
    },
  },
};

// Gemini accepts a smaller JSON Schema subset than the OpenAI Responses API.
// Keep this schema explicit so both providers return the same application payload.
export const GEMINI_DECK_ASSISTANT_SCHEMA = {
  type: "object",
  required: ["message", "evidenceType", "caveats", "suggestion"],
  properties: {
    message: { type: "string" },
    evidenceType: {
      type: "string",
      enum: ["objective", "inference", "preference", "meta", "insufficient_data"],
    },
    caveats: { type: "array", items: { type: "string" } },
    suggestion: {
      type: "object",
      properties: {
        remove: { type: "array", items: geminiOperationSchema() },
        add: { type: "array", items: geminiOperationSchema() },
        expectedImpact: { type: "string" },
        confidence: { type: "string", enum: ["low", "medium", "high"] },
      },
      required: ["remove", "add", "expectedImpact", "confidence"],
    },
  },
};

function operationSchema() {
  return {
    type: "object",
    additionalProperties: false,
    required: ["cardId", "quantity", "reason"],
    properties: {
      cardId: { type: "string" },
      quantity: { type: "integer", minimum: 1, maximum: 4 },
      reason: { type: "string" },
    },
  };
}

function geminiOperationSchema() {
  return {
    type: "object",
    required: ["cardId", "quantity", "reason"],
    properties: {
      cardId: { type: "string" },
      quantity: { type: "integer", minimum: 1, maximum: 4 },
      reason: { type: "string" },
    },
  };
}
