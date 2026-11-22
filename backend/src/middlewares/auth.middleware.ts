import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/prisma.js';
import { JwtUtils } from '../utils/jwt.utils.js';
import { Role, UserStatus } from '@prisma/client';

/**
 * Valida la autenticidad del token JWT provisto en las cookies de sesion (o cabecera Authorization como respaldo).
 */
export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    let token: string | undefined = req.cookies?.auth_token;

    // Respaldo secundario mediante cabecera Authorization si no existe cookie
    if (!token) {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.split(' ')[1];
      }
    }

    if (!token) {
      res.status(401).json({
        status: 'error',
        message: 'Acceso no autorizado. Sesion no iniciada o token no encontrado.',
      });
      return;
    }

    const decoded = JwtUtils.verifyToken(token);

    const user = await prisma.user.findUnique({
      where: { id: decoded.sub },
    });

    if (!user) {
      res.status(401).json({
        status: 'error',
        message: 'Acceso no autorizado. El usuario asociado a la sesion no existe.',
      });
      return;
    }

    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({
      status: 'error',
      message: 'Sesion invalida o expirada.',
    });
  }
};

/**
 * Verifica que el usuario cuente con estado ACTIVE en la plataforma.
 */
export const requireActive = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user || req.user.status !== UserStatus.ACTIVE) {
    res.status(403).json({
      status: 'error',
      message: 'Acceso restringido. Su cuenta no se encuentra en estado activo.',
    });
    return;
  }
  next();
};

/**
 * Valida que el rol del usuario forme parte del conjunto de roles autorizados.
 */
export const authorizeRoles = (...roles: Role[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({
        status: 'error',
        message: 'Acceso denegado. Permisos insuficientes para realizar esta accion.',
      });
      return;
    }
    next();
  };
};
