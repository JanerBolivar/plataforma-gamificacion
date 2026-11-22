import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { matchService } from '../../services/match.service';
import { MatchesResponse } from '../../types/match';
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
} from 'lucide-react';

export const MatchesPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [data, setData] = useState<MatchesResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Modal para creacion de partida
  const [isCreateOpen, setIsCreateOpen] = useState<boolean>(false);
  const [matchName, setMatchName] = useState<string>('');
  const [maxTeams, setMaxTeams] = useState<number>(2);
  const [createLoading, setCreateLoading] = useState<boolean>(false);
  const [createError, setCreateError] = useState<string | null>(null);

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

  const isStaff = user?.role === 'ADMIN' || user?.role === 'TEACHER';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Lobby de Partidas
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Cree o unase a salas de juego colaborativas y gestione su equipo.
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
                onClick={() => navigate(`/matches/${data.myActiveMatch!.match.id}`)}
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
          <TabsTrigger value="history">Historial de Participacion</TabsTrigger>
          {isStaff && <TabsTrigger value="admin">Administracion del Sistema</TabsTrigger>}
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
                    Cree una nueva partida para comenzar a invitar companeros.
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
                        <span>{new Date(m.createdAt).toLocaleTimeString()}</span>
                      </div>
                    </CardContent>

                    <CardFooter className="pt-2 border-t">
                      {isMyCurrent ? (
                        <Button
                          size="sm"
                          onClick={() => navigate(`/matches/${m.id}`)}
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
        <TabsContent value="history">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Historial de Partidas Finalizadas</CardTitle>
              <CardDescription>Registro de partidas en las que ha participado previamente.</CardDescription>
            </CardHeader>
            <CardContent>
              {!data || data.historyMatches.length === 0 ? (
                <p className="text-center py-8 text-xs text-slate-500">
                  No cuenta con registros de partidas finalizadas aun.
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
                        <TableHead className="text-right">Estado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.historyMatches.map((m) => (
                        <TableRow key={m.id}>
                          <TableCell className="font-medium text-xs">{m.name}</TableCell>
                          <TableCell className="text-xs text-slate-500">{m.creatorName}</TableCell>
                          <TableCell className="text-xs">{m.teamCount} equipos</TableCell>
                          <TableCell className="text-xs text-slate-500">
                            {m.finishedAt ? new Date(m.finishedAt).toLocaleDateString() : '-'}
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge variant="outline" className="border-slate-300 text-slate-600 text-xs">
                              Finalizada
                            </Badge>
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
          <TabsContent value="admin">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Todas las Partidas del Sistema</CardTitle>
                <CardDescription>
                  Vision global de partidas en cualquier estado y control operativo.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!data?.allMatches || data.allMatches.length === 0 ? (
                  <p className="text-center py-8 text-xs text-slate-500">No hay partidas registradas.</p>
                ) : (
                  <div className="rounded-md border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50 dark:bg-slate-900/50">
                          <TableHead>Nombre</TableHead>
                          <TableHead>Creador</TableHead>
                          <TableHead>Estado</TableHead>
                          <TableHead>Participantes</TableHead>
                          <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.allMatches.map((m) => (
                          <TableRow key={m.id}>
                            <TableCell className="font-medium text-xs">{m.name}</TableCell>
                            <TableCell className="text-xs text-slate-500">{m.creatorName}</TableCell>
                            <TableCell>
                              {m.status === 'WAITING' && <Badge variant="outline" className="border-amber-400 text-amber-600 text-xs">En espera</Badge>}
                              {m.status === 'IN_PROGRESS' && <Badge variant="success" className="text-xs">En curso</Badge>}
                              {m.status === 'FINISHED' && <Badge variant="outline" className="text-xs">Finalizada</Badge>}
                              {m.status === 'CANCELLED' && <Badge variant="destructive" className="text-xs">Cancelada</Badge>}
                            </TableCell>
                            <TableCell className="text-xs">
                              {m.participantCount} usuarios ({m.teamCount} equipos)
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => navigate(`/matches/${m.id}`)}
                                  className="h-8 px-2 text-xs"
                                >
                                  Ver sala
                                </Button>
                                {m.status === 'WAITING' && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleAdminStart(m.id)}
                                    className="h-8 px-2 text-xs gap-1 border-emerald-500 text-emerald-600"
                                    title="Iniciar partida"
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

      {/* Modal para creacion de partida */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Crear Nueva Partida</DialogTitle>
            <DialogDescription>
              Configure los parametros iniciales de la sala de juego.
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
                placeholder="Ej. Desafio de Algoritmos - Grupo A"
                value={matchName}
                onChange={(e) => setMatchName(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="max-teams" className="text-xs">Cantidad Maxima de Equipos (1 a 6)</Label>
              <Select
                value={maxTeams.toString()}
                onValueChange={(val) => setMaxTeams(parseInt(val, 10))}
              >
                <SelectTrigger id="max-teams">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 equipo (Individual o cooperativo unico)</SelectItem>
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
