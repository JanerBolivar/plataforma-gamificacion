import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { matchService } from '../services/match.service';
import { MatchLobbyDetails, LobbyTeam } from '../types/match';
import { toast } from 'sonner';

export type GameStage = 'SWAMP' | 'CIRCO';

export interface MatchAccessGuardResult {
  isChecking: boolean;
  isAuthorized: boolean;
  lobby: MatchLobbyDetails | null;
  myTeam: LobbyTeam | null;
}

/**
 * Hook reutilizable para control de acceso y redireccionamiento progresivo de etapas de partida.
 *
 * @param matchId Identificador unico de la partida.
 * @param requiredStage Etapa del juego requerida ('SWAMP' | 'CIRCO').
 */
export function useMatchAccessGuard(
  matchId: string | undefined,
  requiredStage: GameStage
): MatchAccessGuardResult {
  const { user, isLoading: isAuthLoading } = useAuth();
  const navigate = useNavigate();

  const [isChecking, setIsChecking] = useState<boolean>(true);
  const [isAuthorized, setIsAuthorized] = useState<boolean>(false);
  const [lobby, setLobby] = useState<MatchLobbyDetails | null>(null);
  const [myTeam, setMyTeam] = useState<LobbyTeam | null>(null);

  useEffect(() => {
    if (isAuthLoading) return;

    if (!matchId) {
      toast.error('Identificador de partida invalido.');
      navigate('/matches', { replace: true });
      return;
    }

    if (!user) {
      toast.error('Debe iniciar sesion para acceder a la partida.');
      navigate('/login', { replace: true });
      return;
    }

    let isMounted = true;

    const validateAccess = async () => {
      setIsChecking(true);
      try {
        const lobbyData = await matchService.getMatchLobby(matchId);

        if (!isMounted) return;

        const match = lobbyData.match;
        const currentStage = match.currentStage || 'LOBBY';
        const isAdmin = user.role === 'ADMIN';

        // 1. Validacion de finalizacion de la partida (aplica para todos los roles)
        if (
          match.status === 'FINISHED' ||
          match.status === 'CANCELLED' ||
          currentStage === 'FINISHED'
        ) {
          toast.info('La partida ya ha finalizado.');
          navigate('/matches', { replace: true });
          return;
        }

        // 2. Si el usuario cuenta con rol ADMIN, se le concede acceso irrestricto sin exigir equipo ni etapa
        if (isAdmin) {
          const foundTeam = lobbyData.teams.find((t) =>
            t.members.some((m) => m.userId === user.id)
          ) || null;

          setLobby(lobbyData);
          setMyTeam(foundTeam);
          setIsAuthorized(true);
          return;
        }

        // 3. Validacion de pertenencia a un equipo de la partida para usuarios regulares
        const foundTeam = lobbyData.teams.find((t) =>
          t.members.some((m) => m.userId === user.id)
        );

        if (!foundTeam) {
          toast.warning('No pertenece a ningun equipo en esta partida.');
          navigate('/matches', { replace: true });
          return;
        }

        // 4. Validacion de estado y etapa general para usuarios regulares
        if (match.status === 'WAITING' || currentStage === 'LOBBY') {
          toast.info('La partida aun se encuentra en sala de espera.');
          navigate(`/matches/${matchId}`, { replace: true });
          return;
        }

        // 5. Validacion progresiva segun la etapa requerida
        if (requiredStage === 'SWAMP') {
          if (currentStage === 'CIRCO') {
            toast.info('La etapa del Pantano ha concluido. Redirigiendo al Circo...');
            navigate(`/game/${matchId}/circo`, { replace: true });
            return;
          }
        } else if (requiredStage === 'CIRCO') {
          if (currentStage === 'SWAMP' && !foundTeam.swampCompleted) {
            toast.warning('Su equipo debe completar las 4 cartas del Pantano para ingresar al Circo.');
            navigate(`/game/${matchId}/pantano`, { replace: true });
            return;
          }
        }

        // Acceso autorizado satisfactoriamente
        setLobby(lobbyData);
        setMyTeam(foundTeam);
        setIsAuthorized(true);
      } catch (err: any) {
        if (!isMounted) return;
        const msg = err.response?.data?.message || 'Error al validar acceso a la partida.';
        toast.error(msg);
        navigate('/matches', { replace: true });
      } finally {
        if (isMounted) {
          setIsChecking(false);
        }
      }
    };

    validateAccess();

    return () => {
      isMounted = false;
    };
  }, [matchId, requiredStage, user, isAuthLoading, navigate]);

  return { isChecking, isAuthorized, lobby, myTeam };
}
