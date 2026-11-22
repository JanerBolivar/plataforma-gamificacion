import { prisma } from '../config/prisma.js';
import { Role, UserStatus } from '@prisma/client';

export interface UserFilterOptions {
  search?: string;
  role?: Role;
  status?: UserStatus;
}

export interface UpdateUserData {
  firstName?: string;
  lastName?: string;
  role?: Role;
  status?: UserStatus;
}

/**
 * Servicio encargado de la gestion y administracion de usuarios.
 */
export class UserService {
  /**
   * Obtiene la lista de usuarios registrados aplicando filtros opcionales.
   */
  public static async listUsers(filters: UserFilterOptions) {
    const whereClause: {
      role?: Role;
      status?: UserStatus;
      OR?: Array<{
        firstName?: { contains: string; mode: 'insensitive' };
        lastName?: { contains: string; mode: 'insensitive' };
        email?: { contains: string; mode: 'insensitive' };
      }>;
    } = {};

    if (filters.role) {
      whereClause.role = filters.role;
    }

    if (filters.status) {
      whereClause.status = filters.status;
    }

    if (filters.search && filters.search.trim() !== '') {
      const search = filters.search.trim();
      whereClause.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    return prisma.user.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Actualiza los datos o permisos de un usuario garantizando las reglas de integridad de administradores.
   */
  public static async updateUser(
    targetUserId: string,
    currentAdminId: string,
    data: UpdateUserData
  ) {
    const userToUpdate = await prisma.user.findUnique({
      where: { id: targetUserId },
    });

    if (!userToUpdate) {
      throw new Error('El usuario especificado no fue encontrado.');
    }

    // Regla de seguridad: un administrador no puede auto-degradarse de rol ni bloquearse
    if (targetUserId === currentAdminId) {
      if (data.role && data.role !== Role.ADMIN) {
        throw new Error('Un administrador no puede revocar su propio rol de administrador.');
      }
      if (data.status && data.status !== UserStatus.ACTIVE) {
        throw new Error('Un administrador no puede modificar su propio estado activo.');
      }
    }

    return prisma.user.update({
      where: { id: targetUserId },
      data: {
        ...(data.firstName && { firstName: data.firstName.trim() }),
        ...(data.lastName && { lastName: data.lastName.trim() }),
        ...(data.role && { role: data.role }),
        ...(data.status && { status: data.status }),
      },
    });
  }
}
