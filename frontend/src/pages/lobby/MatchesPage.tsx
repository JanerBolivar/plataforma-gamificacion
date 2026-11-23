import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { matchService } from '../../services/match.service';
import { MatchesResponse, MatchLobbyDetails, LobbyTeam } from '../../types/match';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
import { toast } from 'sonner';
import {
  Swords,
  Plus,
  ArrowRight,
  LogOut,
  Users,
  Shield,
  Clock,
  Play,
  CheckCircle,
  Ban,
  RefreshCw,
  Trophy,
  Eye,
  Medal,
  Crown,
  Search,
  Calendar,
  Timer,
} from 'lucide-react';

export const MatchesPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const handleNavigateToMatch = (match: { id: string; status: string; currentStage?: string }) => {
    if (match.status === 'IN_PROGRESS') {
      if (match.currentStage === 'CIRCO') {
        navigate(`/game/${match.id}/circo`);
      } else {
        navigate(`/game/${match.id}/pantano`);
      }
    } else {
      navigate(`/matches/${match.id}`);
    }
  };

  const [data, setData] = useState<MatchesResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Modal para creacion de partida
  const [isCreateOpen, setIsCreateOpen] = useState<boolean>(false);
  const [matchName, setMatchName] = useState<string>('');
  const [maxTeams, setMaxTeams] = useState<number>(2);
  const [createLoading, setCreateLoading] = useState<boolean>(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Modal de Historial y Resultados detallados de partida
  const [isDetailsOpen, setIsDetailsOpen] = useState<boolean>(false);
  const [detailsLoading, setDetailsLoading] = useState<boolean>(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [selectedMatchDetails, setSelectedMatchDetails] = useState<MatchLobbyDetails | null>(null);

  // Filtros de busqueda
  const [historySearch, setHistorySearch] = useState<string>('');
  const [adminSearch, setAdminSearch] = useState<string>('');
  const [adminStatusFilter, setAdminStatusFilter] = useState<string>('ALL');

  const fetchMatches = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await matchService.getMatches();
      setData(result);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Error al cargar la lista de partidas.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMatches();
  }, [fetchMatches]);

  const handleCreateMatch = async () => {
    if (!matchName.trim()) {
      setCreateError('El nombre de la partida es obligatorio.');
      return;
    }
    if (maxTeams < 2 || maxTeams > 6) {
      setCreateError('La cantidad de equipos debe ser entre 2 y 6.');
      return;
    }
    setCreateLoading(true);
    setCreateError(null);
    try {
      const newMatch = await matchService.createMatch({
        name: matchName.trim(),
        maxTeams,
      });
      setIsCreateOpen(false);
      setMatchName('');
      navigate(`/matches/${newMatch.id}`);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setCreateError(err.message);
      } else {
        setCreateError('Fallo al crear la partida.');
      }
    } finally {
      setCreateLoading(false);
    }
  };

  const handleJoinMatch = async (matchId: string) => {
    try {
      await matchService.joinMatch(matchId);
      toast.success('Se ha unido a la sala de espera.');
      navigate(`/matches/${matchId}`);
    } catch (err: unknown) {
      if (err instanceof Error) {
        toast.error(err.message);
      } else {
        toast.error('Error al unirse a la partida.');
      }
      fetchMatches();
    }
  };

  const handleLeaveCurrentMatch = async () => {
    if (!data?.myActiveMatch) return;
    try {
      await matchService.leaveMatch(data.myActiveMatch.match.id);
      toast.success('Ha abandonado la partida correctamente.');
      fetchMatches();
    } catch (err: unknown) {
      if (err instanceof Error) {
        toast.error(err.message);
      } else {
        toast.error('Error al salir de la partida.');
      }
    }
  };

  const handleAdminStart = async (matchId: string) => {
    try {
      await matchService.startMatch(matchId);
      toast.success('Partida iniciada satisfactoriamente.');
      fetchMatches();
    } catch (err: unknown) {
      if (err instanceof Error) toast.error(err.message);
      else toast.error('Error al iniciar la partida.');
    }
  };

  const handleAdminFinish = async (matchId: string) => {
    try {
      await matchService.finishMatch(matchId);
      toast.success('Partida finalizada.');
      fetchMatches();
    } catch (err: unknown) {
      if (err instanceof Error) toast.error(err.message);
      else toast.error('Error al finalizar la partida.');
    }
  };

  const handleAdminCancel = async (matchId: string) => {
    try {
      await matchService.cancelMatch(matchId);
      toast.info('Partida cancelada.');
      fetchMatches();
    } catch (err: unknown) {
      if (err instanceof Error) toast.error(err.message);
      else toast.error('Error al cancelar la partida.');
    }
  };

  const handleOpenMatchDetails = async (matchId: string) => {
    setIsDetailsOpen(true);
    setDetailsLoading(true);
    setDetailsError(null);
    setSelectedMatchDetails(null);
    try {
      const details = await matchService.getMatchLobby(matchId);
      setSelectedMatchDetails(details);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setDetailsError(err.message);
      } else {
        setDetailsError('Error al cargar los detalles del historial de la partida.');
      }
    } finally {
      setDetailsLoading(false);
    }
  };

  const formatDuration = (startStr?: string | null, endStr?: string | null): string => {
    if (!startStr || !endStr) return '-';
    const start = new Date(startStr).getTime();
    const end = new Date(endStr).getTime();
    const diffMs = Math.max(0, end - start);
    const totalSeconds = Math.floor(diffMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const hours = Math.floor(minutes / 60);
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    }
    return `${minutes}m ${seconds}s`;
  };

  const formatDate = (dateStr?: string | null): string => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return d.toLocaleString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getRankedTeams = (teams: LobbyTeam[] = []) => {
    return [...teams].sort((a, b) => {
      const oppA = a.circoOpportunities ?? 0;
      const oppB = b.circoOpportunities ?? 0;
      const scoreA = a.score ?? 0;
      const scoreB = b.score ?? 0;
      const posA = a.circoTokenPosition ?? 0;
      const posB = b.circoTokenPosition ?? 0;

      // 1. Si un equipo completo las 3 oportunidades, es el campeon
      if (oppA >= 3 && oppB < 3) return -1;
      if (oppB >= 3 && oppA < 3) return 1;

      // 2. Si ninguno alcanzo 3 oportunidades (ej. tiempo finalizado), gana el de mayor puntaje
      if (scoreB !== scoreA) return scoreB - scoreA;
      if (oppB !== oppA) return oppB - oppA;
      return posB - posA;
    });
  };

  const isStaff = user?.role === 'ADMIN' || user?.role === 'TEACHER';

  const filteredHistoryMatches = (data?.historyMatches || []).filter((m) => {
    if (!historySearch.trim()) return true;
    const query = historySearch.toLowerCase();
    return m.name.toLowerCase().includes(query) || m.creatorName.toLowerCase().includes(query);
  });

  const filteredAdminMatches = (data?.allMatches || []).filter((m) => {
    const matchFilter = adminStatusFilter === 'ALL' || m.status === adminStatusFilter;
    const searchFilter =
      !adminSearch.trim() ||
      m.name.toLowerCase().includes(adminSearch.toLowerCase()) ||
      m.creatorName.toLowerCase().includes(adminSearch.toLowerCase());
    return matchFilter && searchFilter;
  });

  const rankedTeams = selectedMatchDetails ? getRankedTeams(selectedMatchDetails.teams) : [];
  const championTeam = rankedTeams.length > 0 ? rankedTeams[0] : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Lobby de Partidas
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Cree o únase a salas de juego colaborativas, consulte resultados históricos y gestione partidas.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchMatches} disabled={loading} className="gap-2">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
          <Button
            size="sm"
            onClick={() => {
              setCreateError(null);
              setIsCreateOpen(true);
            }}
            disabled={!!data?.myActiveMatch}
            className="gap-2"
          >
            <Plus className="w-4 h-4" />
            Crear Partida
          </Button>
        </div>
      </div>

      {/* Banner de partida activa actual */}
      {data?.myActiveMatch && (
        <Alert className="border-primary/50 bg-primary/5">
          <Swords className="h-5 w-5 text-primary" />
          <AlertTitle className="text-base font-semibold text-primary">
            Usted ya forma parte de una partida activa
          </AlertTitle>
          <AlertDescription className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-2">
            <div className="text-sm text-slate-700 dark:text-slate-300">
              <span className="font-semibold">{data.myActiveMatch.match.name}</span>
              {data.myActiveMatch.team ? (
                <span className="ml-2 text-xs text-slate-500">
                  (Equipo: <span className="font-medium text-primary">{data.myActiveMatch.team.name}</span>)
                </span>
              ) : (
                <span className="ml-2 text-xs text-amber-600">(Sin equipo asignado)</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={handleLeaveCurrentMatch}
                className="gap-1.5 text-xs text-red-600 hover:text-red-700"
              >
                <LogOut className="w-3.5 h-3.5" />
                Salir de la partida
              </Button>
              <Button
                size="sm"
                onClick={() => handleNavigateToMatch(data.myActiveMatch!.match)}
                className="gap-1.5 text-xs"
              >
                Volver a la sala
                <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {error && (
        <div className="rounded-md bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900/50 p-4 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Pestanas de navegacion */}
      <Tabs defaultValue="available" className="space-y-4">
        <TabsList>
          <TabsTrigger value="available">Partidas Disponibles</TabsTrigger>
          <TabsTrigger value="history">Historial de Participación</TabsTrigger>
          {isStaff && <TabsTrigger value="admin">Administración del Sistema</TabsTrigger>}
        </TabsList>

        {/* Tab: Partidas Disponibles */}
        <TabsContent value="available" className="space-y-4">
          {loading ? (
            <div className="text-center py-12 text-sm text-slate-500">
              Cargando partidas disponibles...
            </div>
          ) : !data || data.activeMatches.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12 text-center space-y-3">
                <div className="p-3 bg-slate-100 dark:bg-slate-900 rounded-full text-slate-400">
                  <Swords className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <p className="font-medium text-slate-900 dark:text-slate-100">
                    No hay partidas en sala de espera
                  </p>
                  <p className="text-xs text-slate-500">
                    Cree una nueva partida para comenzar a invitar compañeros.
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {data.activeMatches.map((m) => {
                const isMyCurrent = data.myActiveMatch?.match.id === m.id;
                const disabledJoin = !!data.myActiveMatch && !isMyCurrent;

                return (
                  <Card key={m.id} className="flex flex-col justify-between shadow-sm">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="text-base truncate">{m.name}</CardTitle>
                        <Badge variant="outline" className="border-amber-400 text-amber-600 text-xs">
                          En espera
                        </Badge>
                      </div>
                      <CardDescription className="text-xs">
                        Creada por {m.creatorName}
                      </CardDescription>
                    </CardHeader>

                    <CardContent className="space-y-2 text-xs text-slate-600 dark:text-slate-400">
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <Shield className="w-3.5 h-3.5 text-slate-400" /> Equipos:
                        </span>
                        <span className="font-semibold text-slate-900 dark:text-slate-200">
                          {m.teamCount} / {m.maxTeams}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5 text-slate-400" /> Participantes:
                        </span>
                        <span className="font-semibold text-slate-900 dark:text-slate-200">
                          {m.participantCount}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-slate-400 pt-1">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" /> Fecha:
                        </span>
                        <span>{formatDate(m.createdAt)}</span>
                      </div>
                    </CardContent>

                    <CardFooter className="pt-2 border-t">
                      {isMyCurrent ? (
                        <Button
                          size="sm"
                          onClick={() => handleNavigateToMatch(m)}
                          className="w-full gap-2 text-xs"
                        >
                          Ir a mi sala
                          <ArrowRight className="w-3.5 h-3.5" />
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={disabledJoin}
                          onClick={() => handleJoinMatch(m.id)}
                          className="w-full gap-2 text-xs"
                        >
                          Unirse a la sala
                          <ArrowRight className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </CardFooter>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* Tab: Historial de Participacion */}
        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-base">Historial de Partidas Finalizadas</CardTitle>
                  <CardDescription>
                    Registro de partidas en las que ha participado previamente con resultados y clasificaciones.
                  </CardDescription>
                </div>
                <div className="relative w-full sm:w-64">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                  <Input
                    placeholder="Buscar en historial..."
                    value={historySearch}
                    onChange={(e) => setHistorySearch(e.target.value)}
                    className="h-8 pl-8 text-xs"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {filteredHistoryMatches.length === 0 ? (
                <p className="text-center py-8 text-xs text-slate-500">
                  No cuenta con registros de partidas finalizadas con los criterios de búsqueda.
                </p>
              ) : (
                <div className="rounded-md border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50 dark:bg-slate-900/50">
                        <TableHead>Nombre</TableHead>
                        <TableHead>Creador</TableHead>
                        <TableHead>Equipos</TableHead>
                        <TableHead>Fecha de Cierre</TableHead>
                        <TableHead>Duración</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead className="text-right">Resultados</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredHistoryMatches.map((m) => (
                        <TableRow key={m.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-900/50 transition-colors">
                          <TableCell className="font-semibold text-xs text-slate-900 dark:text-slate-100">
                            {m.name}
                          </TableCell>
                          <TableCell className="text-xs text-slate-500">{m.creatorName}</TableCell>
                          <TableCell className="text-xs">
                            <span className="font-medium text-slate-700 dark:text-slate-300">
                              {m.teamCount} equipos
                            </span>
                            <span className="text-[10px] text-slate-400 block">
                              {m.participantCount} participantes
                            </span>
                          </TableCell>
                          <TableCell className="text-xs text-slate-500">
                            {formatDate(m.finishedAt)}
                          </TableCell>
                          <TableCell className="text-xs text-slate-500">
                            {formatDuration(m.startedAt, m.finishedAt)}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="border-slate-300 text-slate-600 text-xs">
                              Finalizada
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleOpenMatchDetails(m.id)}
                              className="gap-1.5 text-xs border-amber-300 dark:border-amber-700/60 hover:bg-amber-50 dark:hover:bg-amber-950/40 text-amber-700 dark:text-amber-300 font-medium shadow-xs"
                            >
                              <Trophy className="w-3.5 h-3.5 text-amber-500" />
                              Ver Historial
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Administracion */}
        {isStaff && (
          <TabsContent value="admin" className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-base">Todas las Partidas del Sistema</CardTitle>
                    <CardDescription>
                      Supervisión global de partidas en cualquier estado y control operativo.
                    </CardDescription>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="relative w-48 sm:w-60">
                      <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                      <Input
                        placeholder="Buscar por nombre o creador..."
                        value={adminSearch}
                        onChange={(e) => setAdminSearch(e.target.value)}
                        className="h-8 pl-8 text-xs"
                      />
                    </div>
                    <Select value={adminStatusFilter} onValueChange={setAdminStatusFilter}>
                      <SelectTrigger className="h-8 w-36 text-xs">
                        <SelectValue placeholder="Estado" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ALL">Todos los estados</SelectItem>
                        <SelectItem value="WAITING">En espera</SelectItem>
                        <SelectItem value="IN_PROGRESS">En curso</SelectItem>
                        <SelectItem value="FINISHED">Finalizadas</SelectItem>
                        <SelectItem value="CANCELLED">Canceladas</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Metricas de resumen */}
                {data?.allMatches && (
                  <div className="flex flex-wrap gap-2 pt-2 text-xs">
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium">
                      Total: <strong>{data.allMatches.length}</strong>
                    </span>
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 font-medium">
                      En espera: <strong>{data.allMatches.filter((m) => m.status === 'WAITING').length}</strong>
                    </span>
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-medium">
                      En curso: <strong>{data.allMatches.filter((m) => m.status === 'IN_PROGRESS').length}</strong>
                    </span>
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-medium">
                      Finalizadas: <strong>{data.allMatches.filter((m) => m.status === 'FINISHED').length}</strong>
                    </span>
                  </div>
                )}
              </CardHeader>
              <CardContent>
                {filteredAdminMatches.length === 0 ? (
                  <p className="text-center py-8 text-xs text-slate-500">
                    No se encontraron partidas con los filtros seleccionados.
                  </p>
                ) : (
                  <div className="rounded-md border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50 dark:bg-slate-900/50">
                          <TableHead>Nombre</TableHead>
                          <TableHead>Creador</TableHead>
                          <TableHead>Estado</TableHead>
                          <TableHead>Etapa</TableHead>
                          <TableHead>Participantes</TableHead>
                          <TableHead>Fecha Creación</TableHead>
                          <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredAdminMatches.map((m) => (
                          <TableRow key={m.id}>
                            <TableCell className="font-semibold text-xs text-slate-900 dark:text-slate-100">{m.name}</TableCell>
                            <TableCell className="text-xs text-slate-500">{m.creatorName}</TableCell>
                            <TableCell>
                              {m.status === 'WAITING' && (
                                <Badge variant="outline" className="border-amber-400 text-amber-600 text-xs">
                                  En espera
                                </Badge>
                              )}
                              {m.status === 'IN_PROGRESS' && (
                                <Badge variant="success" className="text-xs">
                                  En curso
                                </Badge>
                              )}
                              {m.status === 'FINISHED' && (
                                <Badge variant="outline" className="border-slate-400 text-slate-700 dark:text-slate-300 text-xs">
                                  Finalizada
                                </Badge>
                              )}
                              {m.status === 'CANCELLED' && (
                                <Badge variant="destructive" className="text-xs">
                                  Cancelada
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-xs">
                              <Badge variant="secondary" className="text-[10px]">
                                {m.currentStage || 'LOBBY'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs">
                              {m.participantCount} usuarios ({m.teamCount} equipos)
                            </TableCell>
                            <TableCell className="text-xs text-slate-500">
                              {formatDate(m.createdAt)}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleOpenMatchDetails(m.id)}
                                  className="h-8 px-2 text-xs gap-1 text-slate-600 hover:text-slate-900 dark:text-slate-300 font-medium"
                                  title="Ver historial y resultados completos"
                                >
                                  <Eye className="w-3.5 h-3.5 text-primary" />
                                  Detalles
                                </Button>
                                {m.status === 'WAITING' && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => navigate(`/matches/${m.id}`)}
                                    className="h-8 px-2 text-xs"
                                  >
                                    Ver sala
                                  </Button>
                                )}
                                {m.status === 'IN_PROGRESS' && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleNavigateToMatch(m)}
                                    className="h-8 px-2 text-xs gap-1 border-blue-500 text-blue-600"
                                  >
                                    Entrar
                                  </Button>
                                )}
                                {m.status === 'WAITING' && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={m.teamCount < 2}
                                    onClick={() => handleAdminStart(m.id)}
                                    className={`h-8 px-2 text-xs gap-1 ${
                                      m.teamCount < 2
                                        ? 'opacity-50 cursor-not-allowed text-slate-400 border-slate-300 dark:border-slate-700'
                                        : 'border-emerald-500 text-emerald-600'
                                    }`}
                                    title={
                                      m.teamCount < 2
                                        ? 'Se requieren al menos 2 equipos para iniciar la partida'
                                        : 'Iniciar partida'
                                    }
                                  >
                                    <Play className="w-3.5 h-3.5" /> Iniciar
                                  </Button>
                                )}
                                {m.status === 'IN_PROGRESS' && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleAdminFinish(m.id)}
                                    className="h-8 px-2 text-xs gap-1 border-blue-500 text-blue-600"
                                    title="Finalizar partida"
                                  >
                                    <CheckCircle className="w-3.5 h-3.5" /> Finalizar
                                  </Button>
                                )}
                                {(m.status === 'WAITING' || m.status === 'IN_PROGRESS') && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleAdminCancel(m.id)}
                                    className="h-8 px-2 text-xs gap-1 border-red-400 text-red-600"
                                    title="Cancelar partida"
                                  >
                                    <Ban className="w-3.5 h-3.5" /> Cancelar
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      {/* Modal de Historial y Resultados de Partida */}
      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="sm:max-w-3xl md:max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-amber-500" />
              <DialogTitle className="text-xl font-bold">Historial y Resultados de la Partida</DialogTitle>
            </div>
            <DialogDescription>
              Desglose detallado del desarrollo, podio de equipos, puntajes y participantes.
            </DialogDescription>
          </DialogHeader>

          {detailsLoading ? (
            <div className="py-16 flex flex-col items-center justify-center space-y-3">
              <RefreshCw className="w-7 h-7 animate-spin text-primary" />
              <p className="text-xs text-slate-500">Cargando historial detallado de la partida...</p>
            </div>
          ) : detailsError ? (
            <div className="rounded-md bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900/50 p-4 text-xs text-red-700 dark:text-red-300">
              {detailsError}
            </div>
          ) : selectedMatchDetails ? (
            <div className="space-y-6 py-2">
              {/* Tarjeta de Resumen General */}
              <div className="rounded-xl border bg-slate-50/60 dark:bg-slate-900/60 p-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-3">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                      {selectedMatchDetails.match.name}
                    </h3>
                    <p className="text-xs text-slate-500">
                      Creada por {selectedMatchDetails.match.creator.firstName} {selectedMatchDetails.match.creator.lastName} ({selectedMatchDetails.match.creator.email})
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {selectedMatchDetails.match.status === 'FINISHED' && (
                      <Badge className="bg-emerald-600 text-white">Finalizada</Badge>
                    )}
                    {selectedMatchDetails.match.status === 'IN_PROGRESS' && (
                      <Badge variant="success">En curso</Badge>
                    )}
                    {selectedMatchDetails.match.status === 'WAITING' && (
                      <Badge variant="outline" className="border-amber-400 text-amber-600">En espera</Badge>
                    )}
                    {selectedMatchDetails.match.status === 'CANCELLED' && (
                      <Badge variant="destructive">Cancelada</Badge>
                    )}
                    <Badge variant="secondary" className="text-xs">
                      Etapa: {selectedMatchDetails.match.currentStage || 'LOBBY'}
                    </Badge>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div>
                    <span className="text-slate-400 flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" /> Inicio:
                    </span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {formatDate(selectedMatchDetails.match.startedAt)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" /> Finalización:
                    </span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {formatDate(selectedMatchDetails.match.finishedAt)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 flex items-center gap-1">
                      <Timer className="w-3.5 h-3.5" /> Duración total:
                    </span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {formatDuration(selectedMatchDetails.match.startedAt, selectedMatchDetails.match.finishedAt)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 flex items-center gap-1">
                      <Shield className="w-3.5 h-3.5" /> Equipos:
                    </span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {selectedMatchDetails.teams.length} / {selectedMatchDetails.match.maxTeams}
                    </span>
                  </div>
                </div>
              </div>

              {/* Destacado del Equipo Ganador (si finalizo y hay equipos) */}
              {selectedMatchDetails.match.status === 'FINISHED' && championTeam && (
                <div className="relative overflow-hidden rounded-xl border border-amber-300 bg-gradient-to-r from-amber-500/15 via-yellow-400/10 to-amber-500/15 p-5 shadow-sm dark:border-amber-500/30">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-start gap-3.5">
                      <div className="p-3 bg-amber-500 text-white rounded-xl shadow-md">
                        <Trophy className="w-7 h-7" />
                      </div>
                      <div>
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-800 dark:text-amber-300">
                          <Crown className="w-3.5 h-3.5" /> Equipo Campeón
                        </span>
                        <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-1">
                          {championTeam.name}
                        </h3>
                        <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                          {championTeam.members.length} {championTeam.members.length === 1 ? 'integrante' : 'integrantes'}
                          {championTeam.members.length > 0 && (
                            <span className="ml-1 font-medium text-slate-700 dark:text-slate-300">
                              ({championTeam.members.map((m) => `${m.firstName} ${m.lastName}`).join(', ')})
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 bg-white/80 dark:bg-slate-900/80 backdrop-blur px-4 py-2.5 rounded-lg border border-amber-200/80 dark:border-amber-800/80 self-start sm:self-auto">
                      <div className="text-center">
                        <p className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Puntaje</p>
                        <p className="text-lg font-extrabold text-amber-600 dark:text-amber-400">
                          {championTeam.score ?? 0} <span className="text-xs font-normal">pts</span>
                        </p>
                      </div>
                      <div className="h-7 w-[1px] bg-slate-200 dark:bg-slate-700" />
                      <div className="text-center">
                        <p className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Oportunidades</p>
                        <p className="text-lg font-extrabold text-slate-900 dark:text-slate-100">
                          {championTeam.circoOpportunities ?? 0}/3
                        </p>
                      </div>
                      <div className="h-7 w-[1px] bg-slate-200 dark:bg-slate-700" />
                      <div className="text-center">
                        <p className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Casilla Circo</p>
                        <p className="text-lg font-extrabold text-slate-900 dark:text-slate-100">
                          {(championTeam.circoTokenPosition ?? 0) + 1}/6
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Tabla de Clasificacion y Desempeno */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold flex items-center gap-1.5 text-slate-900 dark:text-slate-100">
                    <Medal className="w-4 h-4 text-primary" />
                    Clasificación General de Equipos ({rankedTeams.length})
                  </h4>
                </div>

                {rankedTeams.length === 0 ? (
                  <p className="text-xs text-slate-500 italic py-4 text-center">
                    No hubo equipos registrados en esta partida.
                  </p>
                ) : (
                  <div className="rounded-lg border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50 dark:bg-slate-900/50">
                          <TableHead className="w-16 text-center">Puesto</TableHead>
                          <TableHead>Equipo</TableHead>
                          <TableHead className="text-center">Puntaje</TableHead>
                          <TableHead className="text-center">Oportunidades</TableHead>
                          <TableHead className="text-center">Casilla Circo</TableHead>
                          <TableHead className="text-center">Pantano</TableHead>
                          <TableHead>Integrantes</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rankedTeams.map((team, idx) => {
                          const isWinner = idx === 0 && selectedMatchDetails.match.status === 'FINISHED';
                          return (
                            <TableRow key={team.id} className={isWinner ? 'bg-amber-500/5 font-medium' : ''}>
                              <TableCell className="text-center">
                                {idx === 0 ? (
                                  <Badge className="bg-amber-500 text-white hover:bg-amber-600 gap-1 px-2">
                                    <Trophy className="w-3 h-3" /> #1
                                  </Badge>
                                ) : idx === 1 ? (
                                  <Badge variant="secondary" className="gap-1 px-2 font-semibold">
                                    <Medal className="w-3 h-3 text-slate-400" /> #2
                                  </Badge>
                                ) : idx === 2 ? (
                                  <Badge variant="outline" className="gap-1 px-2 font-semibold border-amber-600/40 text-amber-700">
                                    <Medal className="w-3 h-3 text-amber-700" /> #3
                                  </Badge>
                                ) : (
                                  <span className="text-xs text-slate-500 font-semibold">#{idx + 1}</span>
                                )}
                              </TableCell>
                              <TableCell>
                                <div className="font-semibold text-xs text-slate-900 dark:text-slate-100">
                                  {team.name}
                                </div>
                                <div className="text-[10px] text-slate-500">
                                  {team.members.length} {team.members.length === 1 ? 'miembro' : 'miembros'}
                                </div>
                              </TableCell>
                              <TableCell className="text-center font-bold text-xs text-amber-600 dark:text-amber-400">
                                {team.score ?? 0} pts
                              </TableCell>
                              <TableCell className="text-center text-xs">
                                <Badge variant="outline" className="text-xs font-semibold">
                                  {team.circoOpportunities ?? 0} / 3
                                </Badge>
                              </TableCell>
                              <TableCell className="text-center text-xs">
                                <span className="font-medium text-slate-800 dark:text-slate-200">
                                  Casilla {(team.circoTokenPosition ?? 0) + 1} de 6
                                </span>
                              </TableCell>
                              <TableCell className="text-center text-xs">
                                {team.swampCompleted ? (
                                  <Badge variant="outline" className="border-emerald-500 text-emerald-600 text-[10px]">
                                    Completado
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="border-slate-300 text-slate-400 text-[10px]">
                                    Pendiente
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell className="text-xs">
                                <div className="flex flex-wrap gap-1">
                                  {team.members.map((m) => (
                                    <span
                                      key={m.userId}
                                      className="inline-flex items-center px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[11px]"
                                      title={`${m.email} (${m.role})`}
                                    >
                                      {m.firstName} {m.lastName}
                                    </span>
                                  ))}
                                  {team.members.length === 0 && (
                                    <span className="text-slate-400 italic text-[11px]">Sin miembros</span>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>

              {/* Participantes sin equipo asignado */}
              {selectedMatchDetails.unassignedParticipants.length > 0 && (
                <div className="space-y-2 pt-1 border-t">
                  <h5 className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                    Participantes en la partida sin equipo asignado ({selectedMatchDetails.unassignedParticipants.length})
                  </h5>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedMatchDetails.unassignedParticipants.map((p) => (
                      <span
                        key={p.userId}
                        className="inline-flex items-center px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-xs"
                      >
                        {p.firstName} {p.lastName}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : null}

          <DialogFooter className="border-t pt-3 flex items-center justify-between">
            <div className="text-xs text-slate-400">
              ID Partida: <code className="text-[10px] font-mono">{selectedMatchDetails?.match.id}</code>
            </div>
            <div className="flex items-center gap-2">
              {selectedMatchDetails?.match.status === 'IN_PROGRESS' && (
                <Button
                  size="sm"
                  onClick={() => {
                    setIsDetailsOpen(false);
                    handleNavigateToMatch(selectedMatchDetails.match);
                  }}
                  className="gap-1.5 text-xs"
                >
                  Ir al juego
                  <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={() => setIsDetailsOpen(false)}>
                Cerrar
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal para creacion de partida */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Crear Nueva Partida</DialogTitle>
            <DialogDescription>
              Configure los parámetros iniciales de la sala de juego.
            </DialogDescription>
          </DialogHeader>

          {createError && (
            <div className="rounded-md bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900/50 p-3 text-xs text-red-700 dark:text-red-300">
              {createError}
            </div>
          )}

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="match-name" className="text-xs">Nombre de la Partida</Label>
              <Input
                id="match-name"
                placeholder="Ej. Desafío de Algoritmos - Grupo A"
                value={matchName}
                onChange={(e) => setMatchName(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="max-teams" className="text-xs">Cantidad Máxima de Equipos (2 a 6)</Label>
              <Select
                value={maxTeams.toString()}
                onValueChange={(val) => setMaxTeams(parseInt(val, 10))}
              >
                <SelectTrigger id="max-teams">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2">2 equipos</SelectItem>
                  <SelectItem value="3">3 equipos</SelectItem>
                  <SelectItem value="4">4 equipos</SelectItem>
                  <SelectItem value="5">5 equipos</SelectItem>
                  <SelectItem value="6">6 equipos</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setIsCreateOpen(false)} disabled={createLoading}>
              Cancelar
            </Button>
            <Button onClick={handleCreateMatch} disabled={createLoading}>
              {createLoading ? 'Creando...' : 'Crear y Entrar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MatchesPage;
