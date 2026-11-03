const DEFAULT_OLLAMA_URL = "http://127.0.0.1:11434";
const DEFAULT_MODEL = "qwen2.5:3b";
const DEFAULT_GEMINI_MODEL = "gemini-3.8-flash";
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models";
const AI_TIMEOUT_MS = 15_000;

type OllamaResponse = {
  response?: string;
  done?: boolean;
};

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
  error?: { message?: string };
};

export type AiFailure = {
  ok: false;
  error: string;
};

export type AiSuccess<T> = {
  ok: true;
  value: T;
};

export type AiResult<T> = AiSuccess<T> | AiFailure;

export type GeneratedCatQuestion = {
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
};

export type GeneratedPracticeQuestion = GeneratedCatQuestion;

function errorMessage(error: unknown) {
  return (error instanceof Error ? error.message : String(error)).slice(0, 240);
}

function ollamaUrl() {
  return (process.env.OLLAMA_BASE_URL || DEFAULT_OLLAMA_URL).replace(/\/+$/, "");
}

export function defaultAiModel() {
  return process.env.OLLAMA_MODEL || DEFAULT_MODEL;
}

export function defaultGeminiModel() {
  return process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL;
}

async function generateOllama(prompt: string, model = defaultAiModel()): Promise<AiResult<string>> {
  if (!model.trim()) return { ok: false, error: "No Ollama model is configured." };
  try {
    const response = await fetch(`${ollamaUrl()}/api/generate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: model.trim(),
        prompt,
        stream: false,
        format: "json",
        options: { temperature: 0.1, num_predict: 300 },
      }),
      signal: AbortSignal.timeout(AI_TIMEOUT_MS),
    });
    if (!response.ok) {
      return { ok: false, error: `Ollama returned HTTP ${response.status}.` };
    }
    const body = await response.json() as OllamaResponse;
    if (!body.response?.trim()) return { ok: false, error: "Ollama returned an empty response." };
    return { ok: true, value: body.response };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof DOMException && error.name === "TimeoutError"
        ? "Ollama timed out after 15 seconds."
        : `Ollama is unavailable: ${errorMessage(error)}`,
    };
  }
}

async function generateGemini(prompt: string, model = defaultGeminiModel()): Promise<AiResult<string>> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) return { ok: false, error: "Gemini is not configured. Add GEMINI_API_KEY to .env.local." };
  if (!model.trim()) return { ok: false, error: "No Gemini model is configured." };

  try {
    const response = await fetch(`${GEMINI_API_URL}/${encodeURIComponent(model.trim())}:generateContent`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 500,
          responseMimeType: "application/json",
        },
      }),
      signal: AbortSignal.timeout(AI_TIMEOUT_MS),
    });
    const body = await response.json() as GeminiResponse;
    if (!response.ok) return { ok: false, error: `Gemini returned HTTP ${response.status}: ${body.error?.message ?? "request failed"}` };
    const text = body.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text?.trim()) return { ok: false, error: "Gemini returned an empty response." };
    return { ok: true, value: text };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof DOMException && error.name === "TimeoutError"
        ? "Gemini timed out after 15 seconds."
        : `Gemini request failed: ${errorMessage(error)}`,
    };
  }
}

function parseObject<T extends object>(raw: string, isValid: (value: T) => boolean, provider = "AI"): AiResult<T> {
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object" || !isValid(value as T)) {
      return { ok: false, error: `${provider} returned JSON in an unexpected shape.` };
    }
    return { ok: true, value: value as T };
  } catch {
    return { ok: false, error: `${provider} returned invalid JSON.` };
  }
}

export async function checkOllama(model = defaultAiModel()): Promise<AiResult<{ model: string }>> {
  const result = await generateOllama("Return only this JSON object: {\"ok\":true}", model);
  if (!result.ok) return result;
  const parsed = parseObject<{ ok: boolean }>(result.value, (value) => value.ok === true);
  return parsed.ok ? { ok: true, value: { model } } : parsed;
}

export async function summarizeArticle(text: string, model?: string): Promise<AiResult<string>> {
  const passage = text.trim().slice(0, 12_000);
  if (!passage) return { ok: false, error: "This article has no readable text to summarize." };
  const result = await generateOllama(
    `You are a concise editorial assistant. Summarize the passage in exactly 3 clear, informative sentences. Return only JSON: {"summary":"..."}. Passage:\n${passage}`,
    model,
  );
  if (!result.ok) return result;
  const parsed = parseObject<{ summary: string }>(result.value, (value) => typeof value.summary === "string" && value.summary.trim().length > 0);
  return parsed.ok ? { ok: true, value: parsed.value.summary.trim().slice(0, 1_500) } : parsed;
}

export async function defineVocabulary(word: string, context: string, model?: string): Promise<AiResult<{ definition: string; example: string }>> {
  const cleanWord = word.trim().slice(0, 80);
  const cleanContext = context.trim().slice(0, 1_000);
  if (!cleanWord || !cleanContext) return { ok: false, error: "A word and its context are required." };
  const result = await generateOllama(
    `Define the word "${cleanWord}" as used in this context: "${cleanContext}". Return only JSON: {"definition":"short definition, max 15 words","example":"one new example sentence"}.`,
    model,
  );
  if (!result.ok) return result;
  return parseObject<{ definition: string; example: string }>(
    result.value,
    (value) => typeof value.definition === "string" && value.definition.trim().length > 0
      && typeof value.example === "string" && value.example.trim().length > 0,
  );
}

const SUMMARY_SCHEMA = "Return only JSON with this shape: {\"summary\":\"exactly 3 clear, informative sentences\"}.";
const VOCAB_SCHEMA = "Return only JSON with this shape: {\"definition\":\"short definition, max 15 words\",\"example\":\"one new example sentence\"}.";

export async function checkGemini(model = defaultGeminiModel()): Promise<AiResult<{ model: string }>> {
  const result = await generateGemini("Return only this JSON object: {\"ok\":true}", model);
  if (!result.ok) return result;
  const parsed = parseObject<{ ok: boolean }>(result.value, (value) => value.ok === true, "Gemini");
  return parsed.ok ? { ok: true, value: { model } } : parsed;
}

export async function summarizeArticleWithGemini(text: string, model = defaultGeminiModel()): Promise<AiResult<string>> {
  const passage = text.trim().slice(0, 12_000);
  if (!passage) return { ok: false, error: "This article has no readable text to summarize." };
  const result = await generateGemini(
    `You are a concise editorial assistant. Summarize the passage in exactly 3 clear, informative sentences. ${SUMMARY_SCHEMA}\nPassage:\n${passage}`,
    model,
  );
  if (!result.ok) return result;
  const parsed = parseObject<{ summary: string }>(result.value, (value) => typeof value.summary === "string" && value.summary.trim().length > 0, "Gemini");
  return parsed.ok ? { ok: true, value: parsed.value.summary.trim().slice(0, 1_500) } : parsed;
}

export async function defineVocabularyWithGemini(word: string, context: string, model = defaultGeminiModel()): Promise<AiResult<{ definition: string; example: string }>> {
  const cleanWord = word.trim().slice(0, 80);
  const cleanContext = context.trim().slice(0, 1_000);
  if (!cleanWord || !cleanContext) return { ok: false, error: "A word and its context are required." };
  const result = await generateGemini(
    `Define the word "${cleanWord}" as used in this context: "${cleanContext}". ${VOCAB_SCHEMA}`,
    model,
  );
  if (!result.ok) return result;
  return parseObject<{ definition: string; example: string }>(
    result.value,
    (value) => typeof value.definition === "string" && value.definition.trim().length > 0
      && typeof value.example === "string" && value.example.trim().length > 0,
    "Gemini",
  );
}

export async function generateCatQuestionsWithGemini(text: string, model = defaultGeminiModel()): Promise<AiResult<GeneratedCatQuestion[]>> {
  const passage = text.trim().slice(0, 16_000);
  if (!passage) return { ok: false, error: "This article has no readable text for question generation." };
  const result = await generateGemini(
    `Create exactly 3 CAT-level Reading Comprehension multiple-choice questions based strictly on this passage. Cover: central argument, a logical inference, and author tone or purpose. Every option must be plausible, but only one can be correct. Do not use outside facts. Return only JSON with this shape: {"questions":[{"question":"...","options":["A","B","C","D"],"correctAnswer":"the exact correct option text","explanation":"brief passage-grounded explanation"}]}. Passage:\n${passage}`,
    model,
  );
  if (!result.ok) return result;
  const parsed = parseObject<{ questions: GeneratedCatQuestion[] }>(
    result.value,
    (value) => Array.isArray(value.questions)
      && value.questions.length === 3
      && value.questions.every((question) => (
        typeof question.question === "string"
        && question.question.trim().length >= 10
        && Array.isArray(question.options)
        && question.options.length === 4
        && question.options.every((option) => typeof option === "string" && option.trim().length > 0)
        && typeof question.correctAnswer === "string"
        && question.options.includes(question.correctAnswer)
        && typeof question.explanation === "string"
        && question.explanation.trim().length >= 10
      )),
    "Gemini",
  );
  if (!parsed.ok) return parsed;
  return {
    ok: true,
    value: parsed.value.questions.map((question) => ({
      question: question.question.trim().slice(0, 1_000),
      options: question.options.map((option) => option.trim().slice(0, 300)),
      correctAnswer: question.correctAnswer.trim().slice(0, 300),
      explanation: question.explanation.trim().slice(0, 1_000),
    })),
  };
}

export async function generatePracticeQuestionsWithGemini(
  domain: string,
  topic: string,
  passage = "",
  model = defaultGeminiModel(),
): Promise<AiResult<GeneratedPracticeQuestion[]>> {
  const cleanDomain = domain.trim().slice(0, 100);
  const cleanTopic = topic.trim().slice(0, 100);
  const cleanPassage = passage.trim().slice(0, 12_000);
  if (!cleanDomain || !cleanTopic) return { ok: false, error: "A domain and topic are required." };
  const context = cleanPassage
    ? `Use this passage as the source for the questions. Do not use outside facts:\n${cleanPassage}`
    : "Create standalone questions without relying on outside facts.";
  const result = await generateGemini(
    `Create exactly 5 original CAT-level multiple-choice practice questions for the ${cleanDomain} topic "${cleanTopic}". ${context} Every question must have exactly four plausible options, one correct answer, and a concise explanation. Avoid duplicates and avoid ambiguous wording. Return only JSON with this shape: {"questions":[{"question":"...","options":["A","B","C","D"],"correctAnswer":"the exact correct option text","explanation":"brief explanation"}]}.`,
    model,
  );
  if (!result.ok) return result;
  const parsed = parseObject<{ questions: GeneratedPracticeQuestion[] }>(
    result.value,
    (value) => Array.isArray(value.questions)
      && value.questions.length === 5
      && value.questions.every((question) => (
        typeof question.question === "string"
        && question.question.trim().length >= 10
        && Array.isArray(question.options)
        && question.options.length === 4
        && question.options.every((option) => typeof option === "string" && option.trim().length > 0)
        && typeof question.correctAnswer === "string"
        && question.options.includes(question.correctAnswer)
        && typeof question.explanation === "string"
        && question.explanation.trim().length >= 10
      )),
    "Gemini",
  );
  if (!parsed.ok) return parsed;
  return {
    ok: true,
    value: parsed.value.questions.map((question) => ({
      question: question.question.trim().slice(0, 1_000),
      options: question.options.map((option) => option.trim().slice(0, 300)),
      correctAnswer: question.correctAnswer.trim().slice(0, 300),
      explanation: question.explanation.trim().slice(0, 1_000),
    })),
  };
}
