import { Request, Response } from 'express';
import { AuthService } from '../services/auth.service.js';
import { prisma } from '../config/prisma.js';
import { env } from '../config/env.js';

/**
 * Controlador de operaciones de autenticacion de usuarios mediante cookies HTTP-Only.
 */
export class AuthController {
  /**
   * Redirige al cliente hacia la pantalla de inicio de sesion de Microsoft Entra ID.
   */
  public static redirectToMicrosoft(_req: Request, res: Response): void {
    const url = AuthService.getAuthorizationUrl();
    res.redirect(url);
  }

  /**
   * Procesa la respuesta de autorizacion de Microsoft, emite la cookie de sesion y redirige a la aplicacion.
   */
  public static async handleCallback(req: Request, res: Response): Promise<void> {
    const { code, error, error_description } = req.query;

    if (error) {
      console.error(`[ERROR] Error recibido desde Microsoft OAuth: ${error} - ${error_description}`);
      res.redirect(`${env.FRONTEND_URL}/login?error=oauth_failed`);
      return;
    }

    if (!code || typeof code !== 'string') {
      res.redirect(`${env.FRONTEND_URL}/login?error=missing_code`);
      return;
    }

    try {
      const jwtToken = await AuthService.handleMicrosoftCallback(code);

      // Fijar cookie de sesion segura HttpOnly
      res.cookie('auth_token', jwtToken, {
        httpOnly: true,
        secure: env.NODE_ENV === 'production',
        sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax',
        maxAge: 8 * 60 * 60 * 1000, // 8 horas en milisegundos
        path: '/',
      });

      // Redirigir al callback del cliente sin exponer el token en la URL
      res.redirect(`${env.FRONTEND_URL}/auth/callback`);
    } catch (err: unknown) {
      console.error('[ERROR] Error durante el procesamiento de la autenticacion:', err);
      res.redirect(`${env.FRONTEND_URL}/login?error=authentication_failed`);
    }
  }

  /**
   * Retorna la informacion del perfil del usuario actualmente autenticado mediante cookie.
   */
  public static async getCurrentUser(req: Request, res: Response): Promise<void> {
    if (!req.user) {
      res.status(401).json({ status: 'error', message: 'No autenticado.' });
      return;
    }

    try {
      // Consultar avatarModel almacenado
      const rows = (await prisma.$queryRawUnsafe(
        'SELECT "avatarModel" FROM "User" WHERE id = $1 LIMIT 1',
        req.user.id
      ).catch(() => [])) as Array<{ avatarModel: string }>;

      const avatarModel = rows[0]?.avatarModel || 'female';

      res.status(200).json({
        status: 'ok',
        data: {
          ...req.user,
          avatarModel,
        },
      });
    } catch {
      res.status(200).json({
        status: 'ok',
        data: {
          ...req.user,
          avatarModel: 'female',
        },
      });
    }
  }

  /**
   * Actualiza la preferencia del modelo de avatar para el usuario en sesion.
   */
  public static async updateAvatar(req: Request, res: Response): Promise<void> {
    if (!req.user) {
      res.status(401).json({ status: 'error', message: 'No autenticado.' });
      return;
    }

    const { avatarModel } = req.body;
    const model = avatarModel === 'man' ? 'man' : 'female';

    try {
      // Asegurar columna avatarModel en caso de que no exista aun en la base de datos
      await prisma.$executeRawUnsafe(
        'ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "avatarModel" TEXT DEFAULT \'female\';'
      ).catch(() => {});

      await prisma.$executeRawUnsafe(
        'UPDATE "User" SET "avatarModel" = $1 WHERE id = $2;',
        model,
        req.user.id
      );

      res.status(200).json({
        status: 'ok',
        message: 'Preferencia de avatar actualizada correctamente.',
        data: { avatarModel: model },
      });
    } catch (err: unknown) {
      console.error('[ERROR] Error al guardar preferencia de avatar:', err);
      res.status(500).json({ status: 'error', message: 'No se pudo guardar la preferencia de avatar.' });
    }
  }

  /**
   * Limpia la cookie de sesion para cerrar la sesion del usuario de forma segura.
   */
  public static logout(_req: Request, res: Response): void {
    res.clearCookie('auth_token', {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax',
      path: '/',
    });
    res.status(200).json({
      status: 'ok',
      message: 'Sesion cerrada exitosamente.',
    });
  }
}
