import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { userService } from '../../services/user.service';
import { User, Role, UserStatus } from '../../types/auth';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Search, Edit, CheckCircle, Ban, RefreshCw, UserCheck } from 'lucide-react';

export const UsersPage: React.FC = () => {
  const { user: currentAdmin } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Estado para el modal de edicion
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState<boolean>(false);
  const [editFirstName, setEditFirstName] = useState<string>('');
  const [editLastName, setEditLastName] = useState<string>('');
  const [editRole, setEditRole] = useState<Role>('STUDENT');
  const [editStatus, setEditStatus] = useState<UserStatus>('PENDING');
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await userService.listUsers({
        search: search.trim() || undefined,
        role: roleFilter !== 'ALL' ? (roleFilter as Role) : undefined,
        status: statusFilter !== 'ALL' ? (statusFilter as UserStatus) : undefined,
      });
      setUsers(data);
    } catch (err: unknown) {
      console.error('[ERROR] Error al consultar usuarios:', err);
    } finally {
      setLoading(false);
    }
  }, [search, roleFilter, statusFilter]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleOpenEdit = (user: User) => {
    setSelectedUser(user);
    setEditFirstName(user.firstName);
    setEditLastName(user.lastName);
    setEditRole(user.role);
    setEditStatus(user.status);
    setActionError(null);
    setIsDialogOpen(true);
  };

  const handleSaveUser = async () => {
    if (!selectedUser) return;
    setActionLoading(true);
    setActionError(null);

    try {
      await userService.updateUser(selectedUser.id, {
        firstName: editFirstName,
        lastName: editLastName,
        role: editRole,
        status: editStatus,
      });
      setIsDialogOpen(false);
      fetchUsers();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setActionError(err.message);
      } else {
        setActionError('Fallo al actualizar los datos del usuario.');
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleQuickActivate = async (user: User) => {
    try {
      await userService.updateUser(user.id, { status: 'ACTIVE' });
      fetchUsers();
    } catch (err: unknown) {
      console.error('[ERROR] Error al activar usuario:', err);
    }
  };

  const handleQuickToggleBlock = async (user: User) => {
    const nextStatus: UserStatus = user.status === 'BLOCKED' ? 'ACTIVE' : 'BLOCKED';
    try {
      await userService.updateUser(user.id, { status: nextStatus });
      fetchUsers();
    } catch (err: unknown) {
      console.error('[ERROR] Error al cambiar estado de usuario:', err);
    }
  };

  const getStatusBadge = (status: UserStatus) => {
    switch (status) {
      case 'ACTIVE':
        return <Badge variant="success">Activo</Badge>;
      case 'PENDING':
        return <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">Pendiente</Badge>;
      case 'BLOCKED':
        return <Badge variant="destructive">Bloqueado</Badge>;
    }
  };

  const getRoleBadge = (role: Role) => {
    switch (role) {
      case 'ADMIN':
        return <Badge variant="default">Administrador</Badge>;
      case 'TEACHER':
        return <Badge variant="outline" className="border-blue-400 text-blue-600 dark:text-blue-400">Docente</Badge>;
      case 'STUDENT':
        return <Badge variant="outline">Estudiante</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Gestion de Usuarios
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Supervise registros, asigne roles y controle el estado de activacion de cuentas.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchUsers} disabled={loading} className="gap-2">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Actualizar
        </Button>
      </div>

      <Card className="border-slate-200 dark:border-slate-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Filtros de Busqueda</CardTitle>
          <CardDescription>Localice usuarios por texto o filtre por rol y estado.</CardDescription>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Buscar por nombre o correo..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 text-sm"
              />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filtrar por rol" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos los roles</SelectItem>
                <SelectItem value="ADMIN">Administrador</SelectItem>
                <SelectItem value="TEACHER">Docente</SelectItem>
                <SelectItem value="STUDENT">Estudiante</SelectItem>
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filtrar por estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos los estados</SelectItem>
                <SelectItem value="ACTIVE">Activo</SelectItem>
                <SelectItem value="PENDING">Pendiente</SelectItem>
                <SelectItem value="BLOCKED">Bloqueado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>

        <CardContent>
          <div className="rounded-md border border-slate-200 dark:border-slate-800 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50 dark:bg-slate-900/50">
                  <TableHead>Nombre Completo</TableHead>
                  <TableHead>Correo Electronico</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Fecha de Registro</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-sm text-slate-500">
                      Cargando listado de usuarios...
                    </TableCell>
                  </TableRow>
                ) : users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-sm text-slate-500">
                      No se encontraron usuarios que coincidan con los criterios.
                    </TableCell>
                  </TableRow>
                ) : (
                  users.map((u) => {
                    const isSelf = currentAdmin?.id === u.id;
                    return (
                      <TableRow key={u.id}>
                        <TableCell className="font-medium">
                          {u.firstName} {u.lastName}
                          {isSelf && (
                            <span className="ml-2 text-xs text-primary font-semibold">(Tú)</span>
                          )}
                        </TableCell>
                        <TableCell className="text-slate-600 dark:text-slate-400 font-mono text-xs">
                          {u.email}
                        </TableCell>
                        <TableCell>{getRoleBadge(u.role)}</TableCell>
                        <TableCell>{getStatusBadge(u.status)}</TableCell>
                        <TableCell className="text-slate-500 text-xs">
                          {new Date(u.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {u.status === 'PENDING' && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleQuickActivate(u)}
                                className="h-8 px-2 text-xs gap-1 border-emerald-500 text-emerald-600 hover:bg-emerald-50"
                                title="Aprobar y activar cuenta"
                              >
                                <CheckCircle className="w-3.5 h-3.5" />
                                Activar
                              </Button>
                            )}

                            {!isSelf && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleQuickToggleBlock(u)}
                                className={`h-8 px-2 text-xs gap-1 ${
                                  u.status === 'BLOCKED'
                                    ? 'border-blue-500 text-blue-600 hover:bg-blue-50'
                                    : 'border-red-400 text-red-600 hover:bg-red-50'
                                }`}
                                title={u.status === 'BLOCKED' ? 'Desbloquear cuenta' : 'Bloquear cuenta'}
                              >
                                {u.status === 'BLOCKED' ? (
                                  <>
                                    <UserCheck className="w-3.5 h-3.5" />
                                    Desbloquear
                                  </>
                                ) : (
                                  <>
                                    <Ban className="w-3.5 h-3.5" />
                                    Bloquear
                                  </>
                                )}
                              </Button>
                            )}

                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleOpenEdit(u)}
                              className="h-8 px-2 text-xs gap-1"
                              title="Editar usuario"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Modal de edicion de usuario */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Usuario</DialogTitle>
            <DialogDescription>
              Modifique los datos de perfil, permisos de acceso o estado de la cuenta.
            </DialogDescription>
          </DialogHeader>

          {actionError && (
            <div className="rounded-md bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900/50 p-3 text-xs text-red-700 dark:text-red-300">
              {actionError}
            </div>
          )}

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="edit-email" className="text-xs">Correo Electronico</Label>
              <Input id="edit-email" value={selectedUser?.email || ''} disabled className="bg-slate-100 dark:bg-slate-900 font-mono text-xs" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="edit-firstname" className="text-xs">Nombres</Label>
                <Input
                  id="edit-firstname"
                  value={editFirstName}
                  onChange={(e) => setEditFirstName(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-lastname" className="text-xs">Apellidos</Label>
                <Input
                  id="edit-lastname"
                  value={editLastName}
                  onChange={(e) => setEditLastName(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-role" className="text-xs">Rol en la Plataforma</Label>
              <Select
                value={editRole}
                onValueChange={(val) => setEditRole(val as Role)}
                disabled={currentAdmin?.id === selectedUser?.id}
              >
                <SelectTrigger id="edit-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="STUDENT">Estudiante</SelectItem>
                  <SelectItem value="TEACHER">Docente</SelectItem>
                  <SelectItem value="ADMIN">Administrador</SelectItem>
                </SelectContent>
              </Select>
              {currentAdmin?.id === selectedUser?.id && (
                <p className="text-[11px] text-slate-400">
                  No puede revocar su propio rol de administrador.
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-status" className="text-xs">Estado de la Cuenta</Label>
              <Select
                value={editStatus}
                onValueChange={(val) => setEditStatus(val as UserStatus)}
                disabled={currentAdmin?.id === selectedUser?.id}
              >
                <SelectTrigger id="edit-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVE">Activo</SelectItem>
                  <SelectItem value="PENDING">Pendiente</SelectItem>
                  <SelectItem value="BLOCKED">Bloqueado</SelectItem>
                </SelectContent>
              </Select>
              {currentAdmin?.id === selectedUser?.id && (
                <p className="text-[11px] text-slate-400">
                  No puede suspender su propia cuenta.
                </p>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={actionLoading}>
              Cancelar
            </Button>
            <Button onClick={handleSaveUser} disabled={actionLoading}>
              {actionLoading ? 'Guardando...' : 'Guardar Cambios'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UsersPage;
