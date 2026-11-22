import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

/**
 * Esquema de validacion de variables de entorno del servidor backend.
 */
const envSchema = z.object({
  PORT: z.string().default('4000').transform((val) => parseInt(val, 10)),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: z.string().optional(),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  MICROSOFT_CLIENT_ID: z.string().default(''),
  MICROSOFT_CLIENT_SECRET: z.string().default(''),
  MICROSOFT_TENANT_ID: z.string().default('common'),
  MICROSOFT_REDIRECT_URI: z.string().default('http://localhost:4000/api/auth/microsoft/callback'),
  JWT_SECRET: z.string().default('super_secret_jwt_key_default_development'),
  JWT_EXPIRES_IN: z.string().default('8h'),
  ADMIN_EMAILS: z.string().default(''),
  FRONTEND_URL: z.string().default('http://localhost:5173'),
  SWAMP_TIME_MINUTES: z.string().default('15').transform((val) => parseInt(val, 10)).pipe(z.number().int().positive()),
});

const _env = envSchema.safeParse(process.env);

if (!_env.success) {
  console.error('[ERROR] Error de validacion en las variables de entorno:', _env.error.format());
  process.exit(1);
}

export const env = _env.data;
