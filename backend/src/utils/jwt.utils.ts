import jwt, { SignOptions } from 'jsonwebtoken';
import { env } from '../config/env.js';
import { UserPayload } from '../models/user.model.js';

/**
 * Servicio utilitario para generacion y verificacion de JSON Web Tokens.
 */
export class JwtUtils {
  /**
   * Genera un token JWT firmado con la clave secreta y duracion configuradas.
   */
  public static generateToken(payload: UserPayload): string {
    const options: SignOptions = {
      expiresIn: env.JWT_EXPIRES_IN as unknown as number,
    };
    return jwt.sign(payload, env.JWT_SECRET, options);
  }

  /**
   * Verifica la validez de un token JWT y retorna su contenido decodificado.
   */
  public static verifyToken(token: string): UserPayload {
    return jwt.verify(token, env.JWT_SECRET) as UserPayload;
  }
}
