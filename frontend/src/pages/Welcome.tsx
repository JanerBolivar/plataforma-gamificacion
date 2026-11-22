import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Gamepad2, UserCheck, Sparkles, BookOpen } from 'lucide-react';

export const Welcome: React.FC = () => {
  const { user } = useAuth();

  const getRoleLabel = (role?: string) => {
    switch (role) {
      case 'ADMIN':
        return 'Administrador';
      case 'TEACHER':
        return 'Docente';
      case 'STUDENT':
        return 'Estudiante';
      default:
        return role;
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Bienvenido, {user?.firstName} {user?.lastName}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Plataforma de gamificacion y experiencias de aprendizaje interactivo.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="px-3 py-1 text-xs font-semibold gap-1.5">
            <UserCheck className="w-3.5 h-3.5 text-primary" />
            Rol: {getRoleLabel(user?.role)}
          </Badge>
          <Badge variant="success" className="px-3 py-1 text-xs font-semibold">
            Activo
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
          <CardHeader className="flex flex-row items-center gap-3">
            <div className="p-2.5 bg-primary/10 rounded-lg text-primary">
              <Gamepad2 className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-base">Modulo de Partidas y Retos</CardTitle>
              <CardDescription>Entornos interactivos y gamificados</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="text-sm text-slate-600 dark:text-slate-400 space-y-2">
            <p>
              El modulo de partidas colaborativas y desafios multijugador se encuentra en fase de preparacion
              para ser habilitado en las siguientes etapas del proyecto.
            </p>
            <p className="text-xs text-slate-400 dark:text-slate-500">
              Soporte planificado para salas multijugador en tiempo real.
            </p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
          <CardHeader className="flex flex-row items-center gap-3">
            <div className="p-2.5 bg-primary/10 rounded-lg text-primary">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-base">Mundo Virtual 3D</CardTitle>
              <CardDescription>Experiencias inmersivas con Three.js</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="text-sm text-slate-600 dark:text-slate-400 space-y-2">
            <p>
              Proximamente estara disponible el explorador tridimensional donde podra interactuar
              con modelos educativos y escenarios virtuales disenados para su aprendizaje.
            </p>
            <p className="text-xs text-slate-400 dark:text-slate-500 flex items-center gap-1">
              <BookOpen className="w-3.5 h-3.5" /> Arquitectura reservada para Fase 4.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Welcome;
