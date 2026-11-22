import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Link, useLocation } from 'react-router-dom';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Home, Users, Swords, LogOut, ChevronUp, Gamepad2 } from 'lucide-react';

export const AppLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, logout } = useAuth();
  const location = useLocation();

  const getInitials = (firstName?: string, lastName?: string) => {
    const first = firstName ? firstName.charAt(0).toUpperCase() : '';
    const last = lastName ? lastName.charAt(0).toUpperCase() : '';
    return `${first}${last}` || 'U';
  };

  const isAdmin = user?.role === 'ADMIN';

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <SidebarHeader className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Gamepad2 className="h-5 w-5" />
            </div>
            <div className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
              <span className="truncate font-semibold">Plataforma</span>
              <span className="truncate text-xs text-muted-foreground">Gamificacion Educativa</span>
            </div>
          </div>
        </SidebarHeader>

        <SidebarContent className="px-2">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={location.pathname === '/'}>
                <Link to="/" className="flex items-center gap-3">
                  <Home className="h-4 w-4" />
                  <span>Inicio</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>

            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={location.pathname.startsWith('/matches')}>
                <Link to="/matches" className="flex items-center gap-3">
                  <Swords className="h-4 w-4" />
                  <span>Partidas</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>

            {isAdmin && (
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={location.pathname.startsWith('/admin/users')}>
                  <Link to="/admin/users" className="flex items-center gap-3">
                    <Users className="h-4 w-4" />
                    <span>Usuarios</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )}
          </SidebarMenu>
        </SidebarContent>

        <SidebarFooter className="p-2">
          <SidebarMenu>
            <SidebarMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton
                    size="lg"
                    className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                  >
                    <Avatar className="h-8 w-8 rounded-lg">
                      <AvatarFallback className="rounded-lg text-xs font-medium">
                        {getInitials(user?.firstName, user?.lastName)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
                      <span className="truncate font-semibold">
                        {user?.firstName} {user?.lastName}
                      </span>
                      <span className="truncate text-xs text-muted-foreground">{user?.email}</span>
                    </div>
                    <ChevronUp className="ml-auto h-4 w-4 group-data-[collapsible=icon]:hidden" />
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
                  side="top"
                  align="end"
                  sideOffset={4}
                >
                  <DropdownMenuLabel className="p-0 font-normal">
                    <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                      <Avatar className="h-8 w-8 rounded-lg">
                        <AvatarFallback className="rounded-lg text-xs">
                          {getInitials(user?.firstName, user?.lastName)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="grid flex-1 text-left text-sm leading-tight">
                        <span className="truncate font-semibold">
                          {user?.firstName} {user?.lastName}
                        </span>
                        <span className="truncate text-xs text-muted-foreground">{user?.email}</span>
                      </div>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={logout} className="gap-2 cursor-pointer text-red-600 focus:text-red-600">
                    <LogOut className="h-4 w-4" />
                    <span>Cerrar sesion</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950">
        <header className="flex h-14 shrink-0 items-center gap-2 border-b bg-background px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
            {location.pathname.startsWith('/admin/users')
              ? 'Gestion de Usuarios'
              : location.pathname.startsWith('/matches')
              ? 'Lobby de Partidas'
              : 'Inicio'}
          </span>
        </header>
        <main className="flex-1 p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
};

export default AppLayout;
