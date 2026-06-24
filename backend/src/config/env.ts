import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(16),
  JWT_EXPIRES_IN: z.string().default('30d'),
  COOKIE_SECURE: z
    .string()
    .default('false')
    .transform((v) => v === 'true'),
  PORT: z
    .string()
    .default('3001')
    .transform((v) => Number.parseInt(v, 10)),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  USDA_API_KEY: z.string().default('DEMO_KEY'),
  // Coach LLM (OpenAI-compatible). Defaults to a locally-hosted Ollama model; override the URL/model
  // to use a cloud provider instead. Local servers need no key, but the SDK requires a non-empty one.
  LLM_API_KEY: z.string().default('ollama'),
  LLM_BASE_URL: z.string().default('http://localhost:11434/v1'),
  LLM_MODEL: z.string().default('qwen2.5:7b-instruct'),
  // json_schema enables Ollama's constrained decoding (guaranteed-valid structure); use json_object
  // for providers that don't support it (e.g. Groq llama).
  LLM_RESPONSE_FORMAT: z.enum(['json_object', 'json_schema']).default('json_schema'),
});

export const env = envSchema.parse(process.env);
