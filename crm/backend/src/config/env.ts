import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  BCRYPT_COST_FACTOR: z.coerce.number().int().min(12).default(12),
  CORS_ORIGINS: z
    .string()
    .default("http://localhost:3000,http://localhost:8081")
    .transform((value) => value.split(",").map((origin) => origin.trim()).filter(Boolean)),
  DATABASE_URL: z.string().url(),
  INACTIVITY_TIMEOUT_SECONDS: z.coerce.number().int().positive().default(1800),
  JWT_EXPIRES_IN: z.coerce.number().int().positive().default(900),
  JWT_SECRET: z.string().min(32),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PASSWORD_RESET_BASE_URL: z.string().url().default("http://localhost:3000"),
  PASSWORD_RESET_EXPIRES_HOURS: z.coerce.number().positive().default(1),
  PORT: z.coerce.number().int().positive().default(3000),
  REFRESH_TOKEN_EXPIRES_DAYS: z.coerce.number().int().positive().default(7),
  REFRESH_TOKEN_SECRET: z.string().min(32),
  SMTP_HOST: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().optional(),
  SMTP_USER: z.string().optional()
});

export const env = envSchema.parse(process.env);
