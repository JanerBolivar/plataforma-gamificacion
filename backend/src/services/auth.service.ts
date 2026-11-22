import axios from 'axios';
import { prisma } from '../config/prisma.js';
import { env } from '../config/env.js';
import { JwtUtils } from '../utils/jwt.utils.js';
import { MicrosoftTokenResponse, MicrosoftUserGraph } from '../models/user.model.js';
import { Role, UserStatus } from '@prisma/client';

/**
 * Servicio encargado de gestionar el flujo de autenticacion con Microsoft Entra ID.
 */
export class AuthService {
  /**
   * Construye la URL de autorizacion OAuth 2.0 de Microsoft.
   */
  public static getAuthorizationUrl(): string {
    const rootUrl = `https://login.microsoftonline.com/${env.MICROSOFT_TENANT_ID}/oauth2/v2.0/authorize`;
    const options = {
      client_id: env.MICROSOFT_CLIENT_ID,
      response_type: 'code',
      redirect_uri: env.MICROSOFT_REDIRECT_URI,
      response_mode: 'query',
      scope: 'openid profile email User.Read',
    };

    const qs = new URLSearchParams(options);
    return `${rootUrl}?${qs.toString()}`;
  }

  /**
   * Intercambia el codigo de autorizacion por token de acceso y procesa el usuario.
   */
  public static async handleMicrosoftCallback(code: string): Promise<string> {
    const tokenUrl = `https://login.microsoftonline.com/${env.MICROSOFT_TENANT_ID}/oauth2/v2.0/token`;

    const tokenParams = new URLSearchParams({
      client_id: env.MICROSOFT_CLIENT_ID,
      client_secret: env.MICROSOFT_CLIENT_SECRET,
      code,
      redirect_uri: env.MICROSOFT_REDIRECT_URI,
      grant_type: 'authorization_code',
    });

    const tokenResponse = await axios.post<MicrosoftTokenResponse>(
      tokenUrl,
      tokenParams.toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    const { access_token } = tokenResponse.data;

    // Obtencion de datos de perfil desde Microsoft Graph
    const graphResponse = await axios.get<MicrosoftUserGraph>(
      'https://graph.microsoft.com/v1.0/me',
      {
        headers: {
          Authorization: `Bearer ${access_token}`,
        },
      }
    );

    const graphUser = graphResponse.data;
    const emailRaw = graphUser.mail || graphUser.userPrincipalName || '';
    const email = emailRaw.trim().toLowerCase();

    if (!email) {
      throw new Error('No fue posible obtener el correo electronico de la cuenta de Microsoft.');
    }

    const firstName = graphUser.givenName || graphUser.displayName?.split(' ')[0] || 'Usuario';
    const lastName = graphUser.surname || graphUser.displayName?.split(' ').slice(1).join(' ') || '';
    const microsoftId = graphUser.id;

    // Comprobacion de administradores predefinidos
    const adminEmails = env.ADMIN_EMAILS.split(',')
      .map((e) => e.trim().toLowerCase())
      .filter((e) => e.length > 0);

    const isAdmin = adminEmails.includes(email);

    // Upsert de usuario en base de datos
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ microsoftId }, { email }],
      },
    });

    let user;

    if (!existingUser) {
      user = await prisma.user.create({
        data: {
          microsoftId,
          email,
          firstName,
          lastName,
          role: isAdmin ? Role.ADMIN : Role.STUDENT,
          status: isAdmin ? UserStatus.ACTIVE : UserStatus.PENDING,
        },
      });
      console.log(`[INFO] Nuevo usuario registrado via Microsoft: ${user.email} con rol ${user.role}`);
    } else {
      user = await prisma.user.update({
        where: { id: existingUser.id },
        data: {
          microsoftId,
          firstName,
          lastName,
          ...(isAdmin && {
            role: Role.ADMIN,
            status: UserStatus.ACTIVE,
          }),
        },
      });
      console.log(`[INFO] Sesion iniciada por usuario existente: ${user.email}`);
    }

    // Generacion de token JWT
    return JwtUtils.generateToken({
      sub: user.id,
      email: user.email,
      role: user.role,
      status: user.status,
    });
  }
}
