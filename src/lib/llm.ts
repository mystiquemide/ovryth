import { GoogleGenAI } from "@google/genai";
import Groq from "groq-sdk";
import { z } from "zod";

/**
 * Ovryth LLM seam. The model classifies and explains; the policy layer decides; the chain enforces.
 * The zod schema is the single source of truth: it is converted to JSON Schema for the provider
 * and then used to validate the response. Nothing unvalidated leaves this function.
 * Generic generateJSON defaults to Gemini flash (thinking off), then Groq fallback.
 * The contribution classifier explicitly overrides that order to Groq primary, Gemini fallback.
 */

export const MODELS = {
  gemini: "gemini-2.5-flash",
  groq: "openai/gpt-oss-120b",
} as const;

export interface GenerateOptions {
  temperature?: number;
  maxOutputTokens?: number;
  timeoutMs?: number;
  /** Force a single provider (used by the fixture gate to measure one model at a time). */
  provider?: "gemini" | "groq";
  /** Provider order when `provider` is not set. Generic default is Gemini then Groq; callers may override it. */
  order?: Array<"gemini" | "groq">;
  failPrimary?: boolean;
}

export interface GenerateResult<T> {
  data: T;
  provider: "gemini" | "groq";
  model: string;
  durationMs: number;
  fellBack: boolean;
}

export class LlmError extends Error {
  constructor(message: string, public cause?: unknown) {
    super(message);
  }
}

let gemini: GoogleGenAI | undefined;
let groq: Groq | undefined;

function geminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new LlmError("GEMINI_API_KEY is not set");
  gemini ??= new GoogleGenAI({ apiKey });
  return gemini;
}

function groqClient() {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new LlmError("GROQ_API_KEY is not set");
  groq ??= new Groq({ apiKey });
  return groq;
}

/** Gemini and Groq reject a few JSON Schema keywords that zod emits. Strip them without changing meaning. */
function jsonSchemaFor(schema: z.ZodType): Record<string, unknown> {
  const raw = z.toJSONSchema(schema, { target: "draft-2020-12" }) as Record<string, unknown>;
  const strip = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(strip);
    if (node && typeof node === "object") {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
        if (k === "$schema" || k === "additionalProperties" || k === "minimum" || k === "maximum") continue;
        out[k] = strip(v);
      }
      return out;
    }
    return node;
  };
  return strip(raw) as Record<string, unknown>;
}

function parseJson(text: string | undefined, provider: string): unknown {
  if (!text) throw new LlmError(`${provider} returned an empty response`);
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    return JSON.parse(trimmed);
  } catch (e) {
    throw new LlmError(`${provider} returned invalid JSON`, e);
  }
}

async function viaGemini(schema: z.ZodType, system: string, user: string, opts: GenerateOptions) {
  const model = MODELS.gemini;
  const res = await geminiClient().models.generateContent({
    model,
    contents: user,
    config: {
      systemInstruction: system,
      responseMimeType: "application/json",
      responseJsonSchema: jsonSchemaFor(schema),
      temperature: opts.temperature ?? 0.1,
      maxOutputTokens: opts.maxOutputTokens ?? 1024,
      thinkingConfig: { thinkingBudget: 0 },
      abortSignal: AbortSignal.timeout(opts.timeoutMs ?? 20_000),
    },
  });
  return { model, raw: parseJson(res.text, "gemini") };
}

async function viaGroq(schema: z.ZodType, system: string, user: string, opts: GenerateOptions) {
  const model = MODELS.groq;
  const res = await groqClient().chat.completions.create(
    {
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      response_format: {
        type: "json_schema",
        json_schema: { name: "response", schema: jsonSchemaFor(schema), strict: false },
      },
      temperature: opts.temperature ?? 0.1,
      max_completion_tokens: opts.maxOutputTokens ?? 1024,
    },
    { timeout: opts.timeoutMs ?? 20_000 },
  );
  return { model, raw: parseJson(res.choices[0]?.message?.content ?? undefined, "groq") };
}

export async function generateJSON<T>(
  schema: z.ZodType<T>,
  system: string,
  user: string,
  opts: GenerateOptions = {},
): Promise<GenerateResult<T>> {
  const started = Date.now();
  const order: Array<"gemini" | "groq"> = opts.provider ? [opts.provider] : opts.order ?? ["gemini", "groq"];
  const errors: string[] = [];

  for (const [i, provider] of order.entries()) {
    try {
      if (opts.failPrimary && i === 0 && order.length > 1) throw new LlmError("forced primary failure");
      const { model, raw } = provider === "gemini" ? await viaGemini(schema, system, user, opts) : await viaGroq(schema, system, user, opts);
      const parsed = schema.safeParse(raw);
      if (!parsed.success) throw new LlmError(`${provider} output failed schema validation: ${parsed.error.issues.map((x) => x.path.join(".") + " " + x.message).join("; ")}`);
      return { data: parsed.data, provider, model, durationMs: Date.now() - started, fellBack: i > 0 };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`${provider}: ${msg}`);
      if (process.env.LLM_DEBUG) console.error(`[llm] ${provider} failed: ${msg.slice(0, 400)}`);
    }
  }
  throw new LlmError(`all providers failed: ${errors.join(" | ")}`);
}
