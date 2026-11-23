import React from 'react';
import { useParams } from 'react-router-dom';
import { useMatchAccessGuard, GameStage } from '../hooks/useMatchAccessGuard';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Compass, Loader2 } from 'lucide-react';

interface MatchAccessGuardProps {
  requiredStage: GameStage;
  children: React.ReactNode;
}

/**
 * Componente envoltorio de proteccion que valida permisos, estado y etapa de la partida
 * antes de renderizar la escena 3D correspondiente.
 */
export const MatchAccessGuard: React.FC<MatchAccessGuardProps> = ({
  requiredStage,
  children,
}) => {
  const { matchId } = useParams<{ matchId: string }>();
  const { isChecking, isAuthorized } = useMatchAccessGuard(matchId, requiredStage);

  if (isChecking) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-950 p-4">
        <Card className="w-full max-w-md border-slate-800 bg-slate-900/90 text-slate-100 shadow-2xl backdrop-blur-md">
          <CardHeader className="text-center pb-4">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-800/80 text-cyan-400">
              <Compass className="h-6 w-6 animate-pulse" />
            </div>
            <CardTitle className="text-lg font-semibold tracking-wide text-slate-200">
              Verificando acceso a la partida
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-center">
            <p className="text-xs text-slate-400">
              Validando etapa ({requiredStage === 'SWAMP' ? 'Pantano' : 'Circo'}), estado y asignación de equipo...
            </p>
            <div className="flex justify-center py-2">
              <Loader2 className="h-6 w-6 animate-spin text-cyan-500" />
            </div>
            <div className="space-y-2 pt-2">
              <Skeleton className="h-4 w-3/4 mx-auto bg-slate-800" />
              <Skeleton className="h-3 w-1/2 mx-auto bg-slate-800/60" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!isAuthorized) {
    return null;
  }

  return <>{children}</>;
};

export default MatchAccessGuard;
