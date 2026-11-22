import { Request, Response } from 'express';
import { UserService } from '../services/user.service.js';
import { Role, UserStatus } from '@prisma/client';
import { z } from 'zod';

const updateUserSchema = z.object({
  firstName: z.string().min(1, 'El nombre no puede estar vacio').optional(),
  lastName: z.string().min(1, 'El apellido no puede estar vacio').optional(),
  role: z.nativeEnum(Role).optional(),
  status: z.nativeEnum(UserStatus).optional(),
});

/**
 * Controlador para las acciones administrativas sobre usuarios.
 */
export class UserController {
  /**
   * Consulta el listado de usuarios con filtros de busqueda.
   */
  public static async listUsers(req: Request, res: Response): Promise<void> {
    try {
      const { search, role, status } = req.query;

      const users = await UserService.listUsers({
        search: typeof search === 'string' ? search : undefined,
        role: Object.values(Role).includes(role as Role) ? (role as Role) : undefined,
        status: Object.values(UserStatus).includes(status as UserStatus)
          ? (status as UserStatus)
          : undefined,
      });

      res.status(200).json({
        status: 'ok',
        data: users,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error al consultar usuarios';
      res.status(500).json({ status: 'error', message });
    }
  }

  /**
   * Actualiza el perfil, rol o estado de un usuario determinado.
   */
  public static async updateUser(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const parseResult = updateUserSchema.safeParse(req.body);

      if (!parseResult.success) {
        res.status(400).json({
          status: 'error',
          message: 'Datos de actualizacion invalidos.',
          errors: parseResult.error.format(),
        });
        return;
      }

      if (!req.user) {
        res.status(401).json({ status: 'error', message: 'No autenticado.' });
        return;
      }

      const updatedUser = await UserService.updateUser(id, req.user.id, parseResult.data);

      res.status(200).json({
        status: 'ok',
        data: updatedUser,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error al actualizar usuario';
      res.status(400).json({ status: 'error', message });
    }
  }
}
