import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { matchService } from '../../services/match.service';
import { MatchLobbyDetails, LobbyParticipant } from '../../types/match';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import {
  Shield,
  Users,
  LogOut,
  Play,
  Plus,
  Mail,
  UserPlus,
  Check,
  X,
  Clock,
  ArrowLeft,
} from 'lucide-react';

export const MatchLobbyPage: React.FC = () => {
  const { id: matchId } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [lobby, setLobby] = useState<MatchLobbyDetails | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Modal para crear equipo
  const [isTeamModalOpen, setIsTeamModalOpen] = useState<boolean>(false);
  const [teamName, setTeamName] = useState<string>('');
  const [teamActionLoading, setTeamActionLoading] = useState<boolean>(false);
  const [teamError, setTeamError] = useState<string | null>(null);

  // Referencia para evitar dobles alertas
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  const fetchLobbyData = useCallback(async (isInitial = false) => {
    if (!matchId) return;
    try {
      const data = await matchService.getMatchLobby(matchId);

      // Si la partida paso a IN_PROGRESS
      if (data.match.status === 'IN_PROGRESS') {
        // Verificar si el usuario forma parte de un equipo
        const myTeam = data.teams.find((t) =>
          t.members.some((m) => m.userId === user?.id)
        );

        if (myTeam) {
          toast.success('La partida ha comenzado.');
          navigate(`/game/${matchId}/pantano`);
          return;
        } else {
          // El usuario no tenia equipo y fue expulsado al iniciar
          toast.error('La partida ha iniciado y usted fue retirado por no pertenecer a ningun equipo.');
          navigate('/matches');
          return;
        }
      }

      // Si fue cancelada o finalizada
      if (data.match.status === 'CANCELLED' || data.match.status === 'FINISHED') {
        toast.info('La partida ya no se encuentra activa.');
        navigate('/matches');
        return;
      }

      setLobby(data);
      if (isInitial) setLoading(false);
    } catch (err: unknown) {
      if (isInitial) {
        setError('No fue posible cargar el lobby de la partida.');
        setLoading(false);
      }
    }
  }, [matchId, user?.id, navigate]);

  useEffect(() => {
    fetchLobbyData(true);

    // Polling cada 3 segundos
    pollingRef.current = setInterval(() => {
      fetchLobbyData(false);
    }, 3000);

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [fetchLobbyData]);

  // Identificar el equipo actual del usuario
  const myCurrentTeam = lobby?.teams.find((t) =>
    t.members.some((m) => m.userId === user?.id)
  );

  const isUserUnassigned = lobby?.unassignedParticipants.some((p) => p.userId === user?.id);

  const isCreatorOrStaff =
    lobby?.match.creator.id === user?.id ||
    user?.role === 'ADMIN' ||
    user?.role === 'TEACHER';

  const handleCreateTeam = async () => {
    if (!teamName.trim() || !matchId) return;
    setTeamActionLoading(true);
    setTeamError(null);
    try {
      await matchService.createTeam(matchId, teamName.trim());
      setIsTeamModalOpen(false);
      setTeamName('');
      fetchLobbyData(false);
    } catch (err: unknown) {
      if (err instanceof Error) setTeamError(err.message);
      else setTeamError('Error al crear el equipo.');
    } finally {
      setTeamActionLoading(false);
    }
  };

  const handleJoinTeam = async (teamId: string) => {
    if (!matchId) return;
    try {
      await matchService.joinTeam(matchId, teamId);
      toast.success('Se ha unido al equipo.');
      fetchLobbyData(false);
    } catch (err: unknown) {
      if (err instanceof Error) toast.error(err.message);
      else toast.error('Error al unirse al equipo.');
    }
  };

  const handleLeaveTeam = async (teamId: string) => {
    if (!matchId) return;
    try {
      await matchService.leaveTeam(matchId, teamId);
      toast.info('Ha salido del equipo.');
      fetchLobbyData(false);
    } catch (err: unknown) {
      if (err instanceof Error) toast.error(err.message);
      else toast.error('Error al salir del equipo.');
    }
  };

  const handleInviteUser = async (teamId: string, inviteeId: string) => {
    if (!matchId) return;
    try {
      await matchService.inviteToTeam(matchId, teamId, inviteeId);
      toast.success('Invitacion enviada correctamente.');
      fetchLobbyData(false);
    } catch (err: unknown) {
      if (err instanceof Error) toast.error(err.message);
      else toast.error('Error al enviar la invitacion.');
    }
  };

  const handleRespondInvitation = async (invitationId: string, action: 'ACCEPT' | 'REJECT') => {
    if (!matchId) return;
    try {
      await matchService.respondInvitation(matchId, invitationId, action);
      if (action === 'ACCEPT') {
        toast.success('Invitacion aceptada. Ha ingresado al equipo.');
      } else {
        toast.info('Invitacion rechazada.');
      }
      fetchLobbyData(false);
    } catch (err: unknown) {
      if (err instanceof Error) toast.error(err.message);
      else toast.error('Error al responder la invitacion.');
    }
  };

  const handleLeaveMatch = async () => {
    if (!matchId) return;
    try {
      await matchService.leaveMatch(matchId);
      toast.success('Ha abandonado la partida.');
      navigate('/matches');
    } catch (err: unknown) {
      if (err instanceof Error) toast.error(err.message);
      else toast.error('Error al salir de la partida.');
    }
  };

  const handleStartMatch = async () => {
    if (!matchId) return;
    try {
      await matchService.startMatch(matchId);
      toast.success('Partida iniciada satisfactoriamente.');
      navigate(`/game/${matchId}/pantano`);
    } catch (err: unknown) {
      if (err instanceof Error) toast.error(err.message);
      else toast.error('Error al iniciar la partida.');
    }
  };

  if (loading) {
    return (
      <div className="text-center py-24 text-sm text-slate-500">
        Cargando sala de espera...
      </div>
    );
  }

  if (error || !lobby) {
    return (
      <div className="space-y-4 max-w-lg mx-auto py-12 text-center">
        <p className="text-sm text-red-600">{error || 'Partida no encontrada.'}</p>
        <Button variant="outline" size="sm" onClick={() => navigate('/matches')} className="gap-2">
          <ArrowLeft className="w-4 h-4" />
          Volver a partidas
        </Button>
      </div>
    );
  }

  const teamsCount = lobby.teams.length;
  const canCreateMoreTeams = teamsCount < lobby.match.maxTeams;

  return (
    <div className="space-y-6">
      {/* Boton para regresar y Encabezado principal */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/matches')}
              className="h-8 px-2 text-xs gap-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Lobby
            </Button>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              {lobby.match.name}
            </h1>
            <Badge variant="outline" className="border-amber-400 text-amber-600 text-xs gap-1">
              <Clock className="w-3 h-3" />
              En espera
            </Badge>
          </div>
          <p className="text-xs text-slate-500">
            Creada por {lobby.match.creator.firstName} {lobby.match.creator.lastName} ({lobby.match.creator.email})
          </p>
        </div>

        {/* Acciones principales del encabezado */}
        <div className="flex items-center gap-2 flex-wrap">
          {isUserUnassigned && canCreateMoreTeams && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setTeamError(null);
                setIsTeamModalOpen(true);
              }}
              className="gap-1.5 text-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              Crear equipo
            </Button>
          )}

          <Button
            size="sm"
            variant="outline"
            onClick={handleLeaveMatch}
            className="gap-1.5 text-xs text-red-600 hover:text-red-700"
          >
            <LogOut className="w-3.5 h-3.5" />
            Salir de la partida
          </Button>

          {isCreatorOrStaff && (
            <Button
              size="sm"
              onClick={handleStartMatch}
              className="gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <Play className="w-3.5 h-3.5" />
              Iniciar partida
            </Button>
          )}
        </div>
      </div>

      {/* Notificaciones de invitaciones pendientes para el usuario */}
      {lobby.myPendingInvitations.length > 0 && (
        <Alert className="border-blue-400 bg-blue-50 dark:bg-blue-950/40">
          <Mail className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <AlertTitle className="text-sm font-semibold text-blue-900 dark:text-blue-300">
            Invitaciones de equipo recibidas
          </AlertTitle>
          <AlertDescription className="space-y-2 mt-2">
            {lobby.myPendingInvitations.map((inv) => (
              <div
                key={inv.id}
                className="flex items-center justify-between gap-4 p-2.5 rounded-lg bg-white dark:bg-slate-900 border text-xs"
              >
                <div>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    {inv.inviter.firstName} {inv.inviter.lastName}
                  </span>{' '}
                  le ha invitado a unirse al equipo{' '}
                  <span className="font-bold text-primary">{inv.team.name}</span>.
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleRespondInvitation(inv.id, 'REJECT')}
                    className="h-7 px-2 text-xs gap-1 border-red-300 text-red-600 hover:bg-red-50"
                  >
                    <X className="w-3 h-3" />
                    Rechazar
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleRespondInvitation(inv.id, 'ACCEPT')}
                    className="h-7 px-2 text-xs gap-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    <Check className="w-3 h-3" />
                    Aceptar
                  </Button>
                </div>
              </div>
            ))}
          </AlertDescription>
        </Alert>
      )}

      {/* Distribucion en 2 columnas: Equipos (Centro) y Participantes sin equipo (Lateral) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Columna Principal: Cuadrícula de Equipos */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold flex items-center gap-2 text-slate-800 dark:text-slate-200">
              <Shield className="w-4 h-4 text-primary" />
              Equipos de la Partida ({teamsCount} / {lobby.match.maxTeams})
            </h2>
            <span className="text-xs text-slate-500">
              Maximo {lobby.match.maxTeamMembers} integrantes por equipo
            </span>
          </div>

          {lobby.teams.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12 text-center space-y-2">
                <Shield className="w-8 h-8 text-slate-300" />
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Aun no hay equipos creados
                </p>
                <p className="text-xs text-slate-400">
                  Cree un equipo para organizar a los participantes de la partida.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {lobby.teams.map((team) => {
                const isMyTeam = myCurrentTeam?.id === team.id;
                const isFull = team.members.length >= lobby.match.maxTeamMembers;
                const canJoinThisTeam = isUserUnassigned && !isFull;

                return (
                  <Card
                    key={team.id}
                    className={`flex flex-col justify-between shadow-sm transition-all ${
                      isMyTeam ? 'border-primary ring-1 ring-primary' : ''
                    }`}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="text-base font-semibold truncate">
                          {team.name}
                        </CardTitle>
                        <Badge
                          variant={isFull ? 'destructive' : isMyTeam ? 'default' : 'outline'}
                          className="text-xs"
                        >
                          {team.members.length} / {lobby.match.maxTeamMembers}
                        </Badge>
                      </div>
                      <CardDescription className="text-xs">
                        {isMyTeam ? 'Tu equipo actual' : 'Equipo participante'}
                      </CardDescription>
                    </CardHeader>

                    <CardContent className="space-y-2 flex-1">
                      <div className="space-y-1.5">
                        {team.members.map((member) => (
                          <div
                            key={member.participantId}
                            className="flex items-center justify-between text-xs py-1 px-2 rounded bg-slate-50 dark:bg-slate-900"
                          >
                            <span className="font-medium truncate">
                              {member.firstName} {member.lastName}
                              {member.userId === user?.id && (
                                <span className="ml-1 text-primary font-bold">(Tú)</span>
                              )}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              {member.role}
                            </span>
                          </div>
                        ))}
                      </div>
                    </CardContent>

                    <CardFooter className="pt-2 border-t">
                      {isMyTeam ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleLeaveTeam(team.id)}
                          className="w-full text-xs text-red-600 hover:text-red-700"
                        >
                          Salir del equipo
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={!canJoinThisTeam}
                          onClick={() => handleJoinTeam(team.id)}
                          className="w-full text-xs"
                        >
                          {isFull ? 'Equipo lleno' : 'Unirse a este equipo'}
                        </Button>
                      )}
                    </CardFooter>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Panel Lateral Derecho: Participantes Sin Equipo */}
        <div className="space-y-4">
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-slate-500" />
                  Usuarios sin equipo
                </span>
                <Badge variant="outline" className="text-xs">
                  {lobby.unassignedParticipants.length}
                </Badge>
              </CardTitle>
              <CardDescription className="text-xs">
                Participantes en la sala que aun no eligen equipo.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-2 max-h-[480px] overflow-y-auto">
              {lobby.unassignedParticipants.length === 0 ? (
                <p className="text-center py-6 text-xs text-slate-400">
                  Todos los participantes tienen equipo asignado.
                </p>
              ) : (
                lobby.unassignedParticipants.map((p: LobbyParticipant) => {
                  const isSelf = p.userId === user?.id;
                  const canInvite =
                    !!myCurrentTeam &&
                    myCurrentTeam.members.length < lobby.match.maxTeamMembers &&
                    !isSelf;

                  return (
                    <div
                      key={p.participantId}
                      className="flex items-center justify-between p-2 rounded-lg border text-xs bg-white dark:bg-slate-900"
                    >
                      <div className="truncate mr-2">
                        <span className="font-medium text-slate-900 dark:text-slate-100">
                          {p.firstName} {p.lastName}
                        </span>
                        {isSelf && <span className="ml-1 text-primary font-bold">(Tú)</span>}
                        <div className="text-[10px] text-slate-400 font-mono truncate">
                          {p.email}
                        </div>
                      </div>

                      {canInvite && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleInviteUser(myCurrentTeam.id, p.userId)}
                          className="h-7 px-2 text-xs gap-1"
                          title="Invitar a mi equipo"
                        >
                          <UserPlus className="w-3 h-3" />
                          Invitar
                        </Button>
                      )}
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Modal para creacion de equipo */}
      <Dialog open={isTeamModalOpen} onOpenChange={setIsTeamModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Crear Nuevo Equipo</DialogTitle>
            <DialogDescription>
              Ingrese el nombre del equipo. Usted sera asignado a el automaticamente.
            </DialogDescription>
          </DialogHeader>

          {teamError && (
            <div className="rounded-md bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900/50 p-3 text-xs text-red-700 dark:text-red-300">
              {teamError}
            </div>
          )}

          <div className="space-y-3 py-2">
            <Label htmlFor="team-name" className="text-xs">Nombre del Equipo</Label>
            <Input
              id="team-name"
              placeholder="Ej. Los Exploradores"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setIsTeamModalOpen(false)} disabled={teamActionLoading}>
              Cancelar
            </Button>
            <Button onClick={handleCreateTeam} disabled={teamActionLoading}>
              {teamActionLoading ? 'Creando...' : 'Crear Equipo'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MatchLobbyPage;
