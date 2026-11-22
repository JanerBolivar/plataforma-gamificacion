import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Gamepad2, UserCheck, Sparkles, BookOpen, User as UserIcon, Check } from 'lucide-react';
import { toast } from 'sonner';
import { ModelPreview } from '../components/game/ModelPreview';

export const Welcome: React.FC = () => {
  const { user, updateAvatarModel } = useAuth();
  const [isUpdatingAvatar, setIsUpdatingAvatar] = useState(false);

  const currentAvatar = user?.avatarModel || 'female';

  const handleSelectAvatar = async (model: 'female' | 'man') => {
    if (model === currentAvatar || isUpdatingAvatar) return;
    setIsUpdatingAvatar(true);
    try {
      await updateAvatarModel(model);
      toast.success(
        model === 'female'
          ? 'Avatar femenino seleccionado y guardado.'
          : 'Avatar masculino seleccionado y guardado.'
      );
    } catch {
      toast.error('No se pudo guardar la seleccion del avatar.');
    } finally {
      setIsUpdatingAvatar(false);
    }
  };

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

      {/* Seccion de Seleccion de Avatar 3D */}
      <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
        <CardHeader className="flex flex-row items-center gap-3">
          <div className="p-2.5 bg-amber-500/10 rounded-lg text-amber-500">
            <UserIcon className="w-5 h-5" />
          </div>
          <div>
            <CardTitle className="text-base">Personalización de Avatar 3D</CardTitle>
            <CardDescription>
              Seleccione la apariencia humanoide para su personaje en las partidas multijugador
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Opcion Avatar Femenino */}
            <div
              onClick={() => handleSelectAvatar('female')}
              className={`relative cursor-pointer rounded-xl border-2 p-4 transition-all flex flex-col justify-between ${
                currentAvatar === 'female'
                  ? 'border-primary bg-primary/5 dark:bg-primary/10 shadow-sm ring-1 ring-primary'
                  : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50'
              }`}
            >
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-slate-900 dark:text-slate-100">
                      Avatar Femenino
                    </span>
                    <Badge variant="outline" className="text-[10px]">
                      Por defecto
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Modelo estilizado femenino con chaqueta azul y falda oscura.
                  </p>
                </div>
                {currentAvatar === 'female' && (
                  <div className="w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0">
                    <Check className="w-3 h-3 stroke-[3]" />
                  </div>
                )}
              </div>

              {/* Visor 3D Interactivo */}
              <ModelPreview modelUrl="/models/pj/female_boddy.glb" className="h-56 my-2" />

              <div className="mt-2 pt-3 border-t border-slate-200/60 dark:border-slate-800 flex justify-between items-center text-xs">
                <span className="text-slate-400 text-[11px] font-mono">female_boddy.glb</span>
                <Button
                  size="sm"
                  variant={currentAvatar === 'female' ? 'default' : 'outline'}
                  disabled={isUpdatingAvatar}
                  className="h-7 text-xs"
                >
                  {currentAvatar === 'female' ? 'Seleccionado' : 'Elegir'}
                </Button>
              </div>
            </div>

            {/* Opcion Avatar Masculino */}
            <div
              onClick={() => handleSelectAvatar('man')}
              className={`relative cursor-pointer rounded-xl border-2 p-4 transition-all flex flex-col justify-between ${
                currentAvatar === 'man'
                  ? 'border-primary bg-primary/5 dark:bg-primary/10 shadow-sm ring-1 ring-primary'
                  : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50'
              }`}
            >
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-slate-900 dark:text-slate-100">
                      Avatar Masculino
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Modelo estilizado masculino con chaqueta verde oscuro y pantalon.
                  </p>
                </div>
                {currentAvatar === 'man' && (
                  <div className="w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0">
                    <Check className="w-3 h-3 stroke-[3]" />
                  </div>
                )}
              </div>

              {/* Visor 3D Interactivo */}
              <ModelPreview modelUrl="/models/pj/man_boddy.glb" className="h-56 my-2" />

              <div className="mt-2 pt-3 border-t border-slate-200/60 dark:border-slate-800 flex justify-between items-center text-xs">
                <span className="text-slate-400 text-[11px] font-mono">man_boddy.glb</span>
                <Button
                  size="sm"
                  variant={currentAvatar === 'man' ? 'default' : 'outline'}
                  disabled={isUpdatingAvatar}
                  className="h-7 text-xs"
                >
                  {currentAvatar === 'man' ? 'Seleccionado' : 'Elegir'}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

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
