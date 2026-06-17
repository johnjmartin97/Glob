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
});

export const env = envSchema.parse(process.env);
