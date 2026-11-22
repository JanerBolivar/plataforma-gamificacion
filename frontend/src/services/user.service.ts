import apiClient from '../api/client';
import { User, Role, UserStatus } from '../types/auth';

export interface UserFilters {
  search?: string;
  role?: Role;
  status?: UserStatus;
}

export interface UpdateUserPayload {
  firstName?: string;
  lastName?: string;
  role?: Role;
  status?: UserStatus;
}

export const authService = {
  /**
   * Obtiene la informacion del usuario en sesion mediante la cookie HttpOnly.
   */
  async getProfile(): Promise<User> {
    const response = await apiClient.get<{ status: string; data: User }>('/api/auth/me');
    return response.data.data;
  },

  /**
   * Cierra la sesion en el backend eliminando la cookie HttpOnly.
   */
  async logout(): Promise<void> {
    await apiClient.post('/api/auth/logout');
  },

  /**
   * Actualiza el modelo de cuerpo del avatar del usuario.
   */
  async updateAvatar(avatarModel: 'female' | 'man'): Promise<{ avatarModel: 'female' | 'man' }> {
    const response = await apiClient.patch<{ status: string; data: { avatarModel: 'female' | 'man' } }>(
      '/api/auth/avatar',
      { avatarModel }
    );
    return response.data.data;
  },
};

export const userService = {
  /**
   * Consulta el listado de usuarios con filtros aplicados.
   */
  async listUsers(filters?: UserFilters): Promise<User[]> {
    const response = await apiClient.get<{ status: string; data: User[] }>('/api/users', {
      params: filters,
    });
    return response.data.data;
  },

  /**
   * Actualiza el perfil, rol o estado de un usuario.
   */
  async updateUser(userId: string, data: UpdateUserPayload): Promise<User> {
    const response = await apiClient.patch<{ status: string; data: User }>(
      `/api/users/${userId}`,
      data
    );
    return response.data.data;
  },
};
