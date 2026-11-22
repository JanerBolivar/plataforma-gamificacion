import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { matchService } from '../../services/match.service';
import { MatchLobbyDetails } from '../../types/match';
import { SwampScene } from '../../game/SwampScene';
import { MapObjectDefinition } from '../../types/map';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Gamepad2,
  LogOut,
  Play,
  Maximize2,
  Minimize2,
  Settings,
  RotateCcw,
  Save,
  Copy,
  Trash2,
  Move,
  RotateCw,
  Plus,
  X,
  Sliders,
  Clock,
  Trophy,
} from 'lucide-react';
import { toast } from 'sonner';
import { NetworkManager, TeamLeaderboardEntry } from '../../game/NetworkManager';
import { Toaster } from '@/components/ui/sonner';

export const GamePage: React.FC = () => {
  const { matchId } = useParams<{ matchId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const gameRootRef = useRef<HTMLDivElement>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const swampSceneRef = useRef<SwampScene | null>(null);
  const networkManagerRef = useRef<NetworkManager | null>(null);

  const [lobby, setLobby] = useState<MatchLobbyDetails | null>(null);
  const [loadingAssets, setLoadingAssets] = useState<boolean>(true);
  const [loadProgress, setLoadProgress] = useState<number>(0);
  const [currentAssetLoading, setCurrentAssetLoading] = useState<string>('Iniciando entorno 3D...');

  // Estado del multijugador y partida
  const [timeRemaining, setTimeRemaining] = useState<number>(15 * 60);
  const [leaderboard, setLeaderboard] = useState<TeamLeaderboardEntry[]>([]);

  // Estado del progreso de recoleccion
  const [collectedCount, setCollectedCount] = useState<number>(0);
  const [portalActive, setPortalActive] = useState<boolean>(false);
  const portalActiveRef = useRef<boolean>(false);
  const lobbyRef = useRef<MatchLobbyDetails | null>(null);
  const [nearbyPrompt, setNearbyPrompt] = useState<string | null>(null);

  // Menu de opciones (al presionar Escape)
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [devCoords, setDevCoords] = useState<{ x: number; y: number; z: number } | null>(null);

  // Estado exclusivo para el Editor de Mapas en desarrollo
  const [isEditorActive, setIsEditorActive] = useState<boolean>(false);
  const [selectedObjectDef, setSelectedObjectDef] = useState<MapObjectDefinition | null>(null);
  const [transformMode, setTransformMode] = useState<'translate' | 'rotate' | 'scale'>('translate');
  const [selectedNewModel, setSelectedNewModel] = useState<string>('Arbol_pantano.glb');
  const [isSavingMap, setIsSavingMap] = useState<boolean>(false);

  // Solicitar pantalla completa
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      const elem = gameRootRef.current || document.documentElement;
      elem
        .requestFullscreen()
        .then(() => setIsFullscreen(true))
        .catch(() => {});
    } else {
      document
        .exitFullscreen()
        .then(() => setIsFullscreen(false))
        .catch(() => {});
    }
  }, []);

  // Cargar datos de la partida
  useEffect(() => {
    if (!matchId) return;

    matchService
      .getMatchLobby(matchId)
      .then((data) => {
        setLobby(data);
        lobbyRef.current = data;
        // Sembrar tabla de posiciones inicial desde los datos de equipos del lobby
        if (data?.teams && data.teams.length > 0) {
          setLeaderboard((prev) => {
            if (prev.length > 0) return prev;
            return data.teams.map((t, idx) => ({
              teamId: t.id,
              name: t.name,
              color: ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'][idx % 6],
              score: (t as any).score || 0,
              cardsCount: 0,
              portalActive: false,
            }));
          });
        }
      })
      .catch((err) => {
        console.error('[ERROR] Error al consultar datos de partida:', err);
      });
  }, [matchId]);

  // Metodos de apertura y cierre del menu de pausa con liberacion de puntero
  const openMenu = useCallback(() => {
    setIsMenuOpen(true);
    if (swampSceneRef.current) {
      const pc = swampSceneRef.current.getPlayerController();
      pc.isMenuOpen = true;
      pc.unlockPointer();
    }
    if (document.pointerLockElement) {
      document.exitPointerLock();
    }
  }, []);

  const handleResumeGame = useCallback(() => {
    setIsMenuOpen(false);
    if (swampSceneRef.current) {
      swampSceneRef.current.getPlayerController().isMenuOpen = false;
    }
    const canvas = canvasContainerRef.current?.querySelector('canvas');
    if (canvas && !isEditorActive) {
      canvas.requestPointerLock();
    }
  }, [isEditorActive]);

  // Manejador de teclado para teclas Alt / M / P / Escape y pantalla completa
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Si presiona Escape y el editor esta activo con objeto seleccionado, deseleccionar
      if (e.code === 'Escape') {
        if (isEditorActive && selectedObjectDef) {
          e.preventDefault();
          swampSceneRef.current?.getMapEditor()?.deselect();
          return;
        }
      }

      // Teclas para alternar el Menu de Opciones en modo normal y pantalla completa
      const isMenuKey =
        e.key === 'Alt' ||
        e.code === 'AltLeft' ||
        e.code === 'AltRight' ||
        e.code === 'KeyM' ||
        e.code === 'KeyP' ||
        e.code === 'Escape';

      if (isMenuKey) {
        e.preventDefault();
        e.stopPropagation();

        if (isMenuOpen) {
          handleResumeGame();
        } else {
          openMenu();
        }
      }
    };

    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    // Usar fase de captura (true) para interceptar teclas antes de que el navegador las consuma en pantalla completa
    window.addEventListener('keydown', handleKeyDown, true);
    document.addEventListener('fullscreenchange', handleFullscreenChange);

    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, [isEditorActive, selectedObjectDef, isMenuOpen, openMenu, handleResumeGame]);

  // Inicializar Three.js y cargar modelos
  useEffect(() => {
    if (!canvasContainerRef.current) return;

    const scene = new SwampScene(canvasContainerRef.current);
    swampSceneRef.current = scene;

    // Conectar notificacion de cambio de coleccion
    scene.collectiblesManager.setCallback((count, _items, isPortalOpen) => {
      setCollectedCount(count);
      setPortalActive(isPortalOpen);
      portalActiveRef.current = isPortalOpen;

      if (isPortalOpen) {
        toast.success('El portal dimensional ha sido activado en el noreste.');
      }
    });

    // Conectar callbacks del editor de mapas si esta en modo desarrollo
    if (import.meta.env.DEV) {
      const editor = scene.getMapEditor();
      if (editor) {
        editor.onActiveStateChange = (active) => {
          setIsEditorActive(active);
        };
        editor.onSelectionChange = (def) => {
          setSelectedObjectDef(def ? { ...def } : null);
        };
        editor.onTransformUpdate = (pos, rot, scale) => {
          setSelectedObjectDef((prev) =>
            prev ? { ...prev, position: pos, rotation: rot, scale } : null
          );
        };
      }
    }

    // Iniciar carga del mundo
    scene
      .initWorld((progress) => {
        const percent = Math.round((progress.loaded / progress.total) * 100);
        setLoadProgress(percent);
        setCurrentAssetLoading(`Cargando ${progress.currentAsset} (${progress.loaded}/${progress.total})`);
      })
      .then(async () => {
        setLoadingAssets(false);
        // Cargar coleccionables dinamicos generados por el backend para esta partida
        if (matchId) {
          try {
            const collectibles = await matchService.getMatchCollectibles(matchId);
            if (collectibles && collectibles.length > 0) {
              await scene.loadDynamicCollectibles(collectibles);
            } else {
              console.log('[INFO] No se encontraron coleccionables persistidos para la partida.');
            }
          } catch (fetchErr) {
            console.warn('[WARN] Error al consultar coleccionables de la partida:', fetchErr);
          }
        }
      })
      .catch((err) => {
        console.error('[ERROR] Error al inicializar el escenario 3D:', err);
        setLoadingAssets(false);
      });

    // Conectar interaccion de tecla E con cartas o portal
    scene.onInteract = (nearby) => {
      if (nearby.type === 'item' && nearby.id) {
        networkManagerRef.current?.sendCollect(nearby.id);
      } else if (nearby.type === 'portal') {
        if (portalActiveRef.current) {
          if (document.fullscreenElement) {
            document.exitFullscreen().catch(() => {});
          }
          navigate(`/game/${matchId}/circo`);
        } else {
          toast.warning('El portal aun no esta activo para su equipo.');
        }
      }
    };

    // Iniciar conexion multijugador Colyseus
    if (matchId) {
      const nm = new NetworkManager();
      networkManagerRef.current = nm;

      nm.onPlayerJoined = (sessionId, player) => {
        scene.addRemotePlayer(sessionId, player);
      };
      nm.onPlayerLeft = (sessionId) => {
        scene.removeRemotePlayer(sessionId);
      };
      nm.onPlayerMoved = (sessionId, player) => {
        scene.updateRemotePlayer(sessionId, player);
      };

      nm.onTimeRemainingChanged = (seconds) => {
        setTimeRemaining(seconds);
      };

      nm.onLeaderboardChanged = (teams) => {
        setLeaderboard(teams);
        const currentLobby = lobbyRef.current;
        const myTeam = currentLobby?.teams?.find((t) => t.members.some((m) => m.userId === user?.id));
        if (myTeam) {
          const teamEntry = teams.find((t) => t.teamId === myTeam.id);
          if (teamEntry) {
            setPortalActive(teamEntry.portalActive);
            portalActiveRef.current = teamEntry.portalActive;
            setCollectedCount(teamEntry.cardsCount);
            scene.collectiblesManager.setPortalActive(teamEntry.portalActive);
          }
        }
      };

      nm.onCollectibleCollected = (collectibleId) => {
        scene.collectiblesManager.markCollected(collectibleId);
      };

      nm.onCardCollected = (evt) => {
        scene.getSoundManager().playCardCollectedSound();
        toast.info(`El equipo "${evt.teamName}" recolecto ${evt.collectibleType} (+${evt.points} pts).`);
      };

      nm.onPortalActivated = (evt) => {
        scene.getSoundManager().playPortalActivatedSound();
        toast.success(`¡El equipo "${evt.teamName}" completo sus 4 cartas y activo el portal dimensional!`);
      };

      nm.onTimeExpired = (evt) => {
        toast.error(evt.message || 'Se ha acabado el tiempo de ejecucion. Sera trasladado al escenario Circo.');
        setTimeout(() => {
          if (document.fullscreenElement) {
            document.exitFullscreen().catch(() => {});
          }
          navigate(`/game/${matchId}/circo`);
        }, 3000);
      };

      nm.onMatchTerminated = (evt) => {
        toast.error(evt.message || 'La partida ha sido finalizada por un administrador.');
        setTimeout(() => {
          if (document.fullscreenElement) {
            document.exitFullscreen().catch(() => {});
          }
          navigate('/matches');
        }, 2000);
      };

      nm.joinMatch(matchId).catch((err) => {
        console.warn('[WARN] No se pudo unir a la sala multijugador Colyseus:', err);
      });
    }

    // Intervalo ligero para comprobar objeto cercano y actualizar mensaje en pantalla
    const checkNearbyInterval = setInterval(() => {
      if (swampSceneRef.current) {
        const nearby = swampSceneRef.current.getNearbyInteraction();

        if (nearby) {
          if (nearby.type === 'item') {
            setNearbyPrompt(`Presione [E] para recoger "${nearby.name}"`);
          } else if (nearby.type === 'portal') {
            setNearbyPrompt(
              portalActiveRef.current
                ? 'Portal dimensional activo. Presione [E] para ingresar al Circo.'
                : 'Portal dimensional bloqueado. Su equipo necesita recolectar las 4 cartas.'
            );
          }
        } else {
          setNearbyPrompt(null);
        }

        const pos = swampSceneRef.current.getPlayerPosition();
        setDevCoords({
          x: Number(pos.x.toFixed(2)),
          y: Number(pos.y.toFixed(2)),
          z: Number(pos.z.toFixed(2)),
        });
      }
    }, 150);

    // Intervalo de transmision de movimiento hacia el servidor Colyseus (~18 FPS)
    const syncMovementInterval = setInterval(() => {
      if (swampSceneRef.current && networkManagerRef.current) {
        const pc = swampSceneRef.current.getPlayerController();
        const pos = pc.getPosition();
        const ry = pc.getYaw();
        const animState = pc.getAnimationState();
        networkManagerRef.current.sendMove(pos.x, pos.y, pos.z, ry, animState);
      }
    }, 55);

    return () => {
      clearInterval(checkNearbyInterval);
      clearInterval(syncMovementInterval);
      if (networkManagerRef.current) {
        networkManagerRef.current.leave();
        networkManagerRef.current = null;
      }
      if (swampSceneRef.current) {
        swampSceneRef.current.dispose();
        swampSceneRef.current = null;
      }
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
    };
  }, []);

  const myTeam = lobby?.teams.find((t) =>
    t.members.some((m) => m.userId === user?.id)
  );

  const handleExitGame = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
    navigate('/matches');
  };

  const handleResetSpawn = () => {
    if (swampSceneRef.current) {
      swampSceneRef.current.resetPlayerSpawn();
      toast.info('Posicion restablecida al inicio de la sala.');
    }
    handleResumeGame();
  };

  // Metodos de manipulacion del editor
  const handleToggleEditor = () => {
    if (swampSceneRef.current?.getMapEditor()) {
      swampSceneRef.current.getMapEditor()?.toggleActive();
    }
  };

  const handleSetGizmoMode = (mode: 'translate' | 'rotate' | 'scale') => {
    setTransformMode(mode);
    swampSceneRef.current?.getMapEditor()?.setMode(mode);
  };

  const handleDuplicateObject = () => {
    const editor = swampSceneRef.current?.getMapEditor();
    if (editor) {
      const dup = editor.duplicateSelected();
      if (dup) {
        toast.success(`Objeto duplicado: ${dup.model}`);
      }
    }
  };

  const handleDeleteObject = () => {
    const editor = swampSceneRef.current?.getMapEditor();
    if (editor) {
      const id = selectedObjectDef?.id;
      if (editor.deleteSelected()) {
        toast.info(`Objeto eliminado del mapa: ${id}`);
      }
    }
  };

  const handleAddNewObject = () => {
    const editor = swampSceneRef.current?.getMapEditor();
    if (editor) {
      const cat = selectedNewModel.startsWith('Choza') || selectedNewModel.startsWith('Sala') ? 'structure' : 'vegetation';
      const added = editor.addNewObject(selectedNewModel, cat);
      if (added) {
        toast.success(`Nueva instancia agregada: ${selectedNewModel}`);
      }
    }
  };

  const handleSaveMap = async () => {
    const editor = swampSceneRef.current?.getMapEditor();
    if (!editor) return;

    setIsSavingMap(true);
    try {
      const result = await editor.saveMapToDisk();
      if (result.success) {
        toast.success(result.message);
      } else {
        toast.error('Error al guardar el mapa.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al guardar';
      toast.error(msg);
    } finally {
      setIsSavingMap(false);
    }
  };

  const handleManualCoordChange = (axis: 'x' | 'y' | 'z', value: number) => {
    if (!selectedObjectDef) return;
    const current = [...selectedObjectDef.position] as [number, number, number];
    if (axis === 'x') current[0] = value;
    if (axis === 'y') current[1] = value;
    if (axis === 'z') current[2] = value;

    swampSceneRef.current?.getMapEditor()?.updateSelectedTransform(current);
  };

  const handleManualRotChange = (axis: 'x' | 'y' | 'z', value: number) => {
    if (!selectedObjectDef) return;
    const current = [...selectedObjectDef.rotation] as [number, number, number];
    if (axis === 'x') current[0] = value;
    if (axis === 'y') current[1] = value;
    if (axis === 'z') current[2] = value;

    swampSceneRef.current?.getMapEditor()?.updateSelectedTransform(undefined, current);
  };

  const availableModels = swampSceneRef.current?.getMapEditor()?.getAvailableModels() || [
    'Sala_Bienvenida.glb',
    'Choza_Alta.glb',
    'Choza_Baja.glb',
    'Arbol_pantano.glb',
    'Tronco.glb',
    'Arbol_TP.glb',
    'TP.glb',
    'Adivinalo.glb',
    'Carta_Pregunta.glb',
    'TiburonAzul.glb',
    'TiburonRojo.glb',
  ];

  return (
    <div
      ref={gameRootRef}
      className="fixed inset-0 w-screen h-screen overflow-hidden bg-slate-950 select-none z-50"
    >
      {/* Contenedor del lienzo WebGL de Three.js ocupando el 100% absoluto de la pantalla */}
      <div ref={canvasContainerRef} className="w-full h-full cursor-crosshair" />

      {/* Notificaciones Sonner montadas dentro del contenedor de pantalla completa */}
      <Toaster position="top-right" richColors />

      {/* Pantalla de carga superpuesta mientras se descargan e instancian los GLB */}
      {loadingAssets && (
        <div className="absolute inset-0 bg-slate-950 flex flex-col items-center justify-center p-6 z-50">
          <Card className="w-full max-w-md border-slate-800 bg-slate-900 shadow-2xl">
            <CardHeader className="text-center space-y-2">
              <div className="inline-flex items-center justify-center p-3 bg-primary/10 rounded-2xl text-primary mx-auto">
                <Gamepad2 className="w-8 h-8 text-primary" />
              </div>
              <CardTitle className="text-xl text-slate-100">
                Cargando Escenario 3D
              </CardTitle>
              <p className="text-xs text-slate-400">
                Isla del Pantano - Plataforma Educativa
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <Progress value={loadProgress} className="h-2" />
              <div className="flex justify-between text-xs text-slate-400">
                <span className="truncate">{currentAssetLoading}</span>
                <span className="font-mono">{loadProgress}%</span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* HUD: Lateral Izquierdo Centrado (Tabla de Posiciones, Estado de Equipo y Boton de Menu) */}
      {!loadingAssets && (
        <div className="absolute left-4 top-1/2 -translate-y-1/2 z-40 pointer-events-none w-72">
          <Card className="bg-slate-900/90 backdrop-blur-md border-slate-800 shadow-2xl pointer-events-auto p-3.5 space-y-3">
            {/* Encabezado: Titulo de Tabla y Partida */}
            <div className="border-b border-slate-800 pb-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                  <Trophy className="w-3.5 h-3.5" />
                  Tabla de Posiciones
                </span>
                <Badge variant="outline" className="text-[10px] text-slate-400 border-slate-700">
                  Pantano
                </Badge>
              </div>
              <p className="text-[11px] text-slate-400 truncate mt-1">
                Partida: <strong className="text-slate-200">{lobby?.match.name || 'En curso'}</strong>
              </p>
            </div>

            {/* Lista de Equipos en la Tabla de Posiciones */}
            <div className="space-y-1.5 text-xs max-h-48 overflow-y-auto pr-0.5">
              {leaderboard.length > 0 ? (
                leaderboard.map((team, idx) => {
                  const isMyTeam = team.teamId === myTeam?.id;
                  return (
                    <div
                      key={team.teamId}
                      className={`flex items-center justify-between p-2 rounded-md transition-all ${
                        isMyTeam
                          ? 'bg-primary/25 border border-primary/60 font-semibold text-slate-100 shadow-sm ring-1 ring-primary/40'
                          : 'text-slate-300 hover:bg-slate-800/40 border border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="font-bold text-slate-400 text-[11px] w-4">#{idx + 1}</span>
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: team.color }}
                        />
                        <span className="truncate">{team.name}</span>
                        {isMyTeam && (
                          <span className="text-[9px] font-bold text-primary-foreground bg-primary px-1.5 py-0.5 rounded-full shrink-0 ml-1">
                            Tu equipo
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[11px] text-slate-400 font-mono">
                          {team.cardsCount}/4
                        </span>
                        <Badge
                          variant="outline"
                          className="text-[10px] font-mono px-1.5 py-0 border-amber-500/30 text-amber-300"
                        >
                          {team.score} pts
                        </Badge>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-slate-500 text-center py-2 text-[11px]">Sincronizando equipos...</div>
              )}
            </div>

            {/* Estado del Portal del Equipo del Jugador */}
            <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs">
              <span className="text-slate-400">Portal de tu equipo:</span>
              <Badge
                variant={portalActive ? 'default' : 'outline'}
                className={
                  portalActive
                    ? 'animate-pulse text-[10px] bg-emerald-600 text-white font-medium'
                    : 'text-slate-500 border-slate-700 text-[10px]'
                }
              >
                {portalActive ? 'Activo (Presione E)' : `Bloqueado (${collectedCount}/4)`}
              </Badge>
            </div>

            {/* Boton Inferior: Menu (Alt / M) y Editor [F2] si esta en desarrollo */}
            <div className="pt-2 border-t border-slate-800 space-y-1.5">
              {import.meta.env.DEV && (
                <Button
                  variant={isEditorActive ? 'default' : 'outline'}
                  size="sm"
                  onClick={handleToggleEditor}
                  className="w-full h-7 text-[11px] gap-1.5"
                  title="Alternar Editor de Mapas (F2)"
                >
                  <Sliders className="w-3 h-3" />
                  Editor [F2]
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={openMenu}
                className="w-full h-8 text-xs gap-1.5 bg-slate-800/80 hover:bg-slate-700 border-slate-700 text-slate-200"
                title="Pausar y abrir menu (Alt o M)"
              >
                <Settings className="w-3.5 h-3.5" />
                Menu (Alt / M)
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Temporizador Superior Central */}
      {!loadingAssets && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40 pointer-events-none">
          <div
            className={`px-4 py-1.5 rounded-full border backdrop-blur-md shadow-xl flex items-center gap-2 pointer-events-auto ${
              timeRemaining < 60
                ? 'bg-red-950/95 border-red-500/70 text-red-200 animate-pulse'
                : 'bg-slate-900/95 border-amber-500/50 text-amber-300'
            }`}
          >
            <Clock className={`w-4 h-4 ${timeRemaining < 60 ? 'text-red-400' : 'text-amber-400'}`} />
            <span className="font-mono font-bold text-sm tracking-wider text-slate-100">
              {String(Math.floor(timeRemaining / 60)).padStart(2, '0')}:
              {String(timeRemaining % 60).padStart(2, '0')}
            </span>
          </div>
        </div>
      )}

      {/* PANEL LATERAL DEL EDITOR DE MAPA (Exclusivo en modo desarrollo cuando F2 esta activo) */}
      {import.meta.env.DEV && isEditorActive && (
        <div className="absolute top-4 right-4 z-50 w-80 max-h-[92vh] overflow-y-auto space-y-3 pointer-events-auto">
          <Card className="bg-slate-900/95 backdrop-blur-md border-slate-800 shadow-2xl p-4 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-bold text-slate-100">Editor de Mapa</h3>
                <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/30">
                  DEV
                </Badge>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleToggleEditor}
                className="h-7 w-7 p-0 text-slate-400 hover:text-slate-100"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            {/* Accion de guardado permanente en disco */}
            <div className="space-y-2">
              <Button
                onClick={handleSaveMap}
                disabled={isSavingMap}
                className="w-full justify-center gap-2 text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-medium"
              >
                <Save className="w-3.5 h-3.5" />
                {isSavingMap ? 'Guardando en disco...' : 'Guardar Mapa en Disco'}
              </Button>
              <p className="text-[10px] text-slate-500 text-center">
                Actualiza directamente <code>frontend/public/maps/pantano-map.json</code>
              </p>
            </div>

            {/* Agregar nuevo objeto al mapa */}
            <div className="space-y-2 pt-2 border-t border-slate-800">
              <Label className="text-xs text-slate-300">Instanciar Nuevo Objeto</Label>
              <div className="flex gap-2">
                <Select value={selectedNewModel} onValueChange={setSelectedNewModel}>
                  <SelectTrigger className="h-8 text-xs bg-slate-950 border-slate-700">
                    <SelectValue placeholder="Seleccionar modelo..." />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800 text-slate-100">
                    {availableModels.map((m) => (
                      <SelectItem key={m} value={m} className="text-xs">
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  onClick={handleAddNewObject}
                  className="h-8 px-2 text-xs gap-1 bg-primary hover:bg-primary/90"
                  title="Colocar frente a la camara"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Crear
                </Button>
              </div>
            </div>

            {/* Inspeccion y transformacion del objeto seleccionado */}
            {selectedObjectDef ? (
              <div className="space-y-3 pt-2 border-t border-slate-800">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-mono text-primary font-semibold truncate block max-w-[170px]">
                      {selectedObjectDef.id}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {selectedObjectDef.model} ({selectedObjectDef.category})
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => swampSceneRef.current?.getMapEditor()?.deselect()}
                    className="h-6 px-1.5 text-[10px] text-slate-400 hover:text-slate-200"
                  >
                    Deseleccionar
                  </Button>
                </div>

                {/* Modos de gizmo */}
                <div className="flex gap-1.5 bg-slate-950 p-1 rounded-md border border-slate-800">
                  <Button
                    variant={transformMode === 'translate' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => handleSetGizmoMode('translate')}
                    className="flex-1 h-7 text-[11px] gap-1"
                  >
                    <Move className="w-3 h-3" />
                    Mover
                  </Button>
                  <Button
                    variant={transformMode === 'rotate' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => handleSetGizmoMode('rotate')}
                    className="flex-1 h-7 text-[11px] gap-1"
                  >
                    <RotateCw className="w-3 h-3" />
                    Rotar (Ctrl)
                  </Button>
                </div>

                {/* Campos numericos de posicion exacta */}
                <div className="space-y-1.5">
                  <span className="text-[11px] font-medium text-slate-300">Posición Mundial (X, Y, Z)</span>
                  <div className="grid grid-cols-3 gap-1.5">
                    <div>
                      <span className="text-[9px] text-slate-500 font-mono">X</span>
                      <Input
                        type="number"
                        step="0.5"
                        value={selectedObjectDef.position[0]}
                        onChange={(e) => handleManualCoordChange('x', parseFloat(e.target.value) || 0)}
                        className="h-7 text-xs bg-slate-950 border-slate-700 px-1.5 font-mono"
                      />
                    </div>
                    <div>
                      <span className="text-[9px] text-slate-500 font-mono">Y (Alt)</span>
                      <Input
                        type="number"
                        step="0.5"
                        value={selectedObjectDef.position[1]}
                        onChange={(e) => handleManualCoordChange('y', parseFloat(e.target.value) || 0)}
                        className="h-7 text-xs bg-slate-950 border-slate-700 px-1.5 font-mono"
                      />
                    </div>
                    <div>
                      <span className="text-[9px] text-slate-500 font-mono">Z</span>
                      <Input
                        type="number"
                        step="0.5"
                        value={selectedObjectDef.position[2]}
                        onChange={(e) => handleManualCoordChange('z', parseFloat(e.target.value) || 0)}
                        className="h-7 text-xs bg-slate-950 border-slate-700 px-1.5 font-mono"
                      />
                    </div>
                  </div>
                </div>

                {/* Campos numericos de rotacion exacta */}
                <div className="space-y-1.5">
                  <span className="text-[11px] font-medium text-slate-300">Rotación Radián (RX, RY, RZ)</span>
                  <div className="grid grid-cols-3 gap-1.5">
                    <div>
                      <span className="text-[9px] text-slate-500 font-mono">RX</span>
                      <Input
                        type="number"
                        step="0.1"
                        value={selectedObjectDef.rotation[0]}
                        onChange={(e) => handleManualRotChange('x', parseFloat(e.target.value) || 0)}
                        className="h-7 text-xs bg-slate-950 border-slate-700 px-1.5 font-mono"
                      />
                    </div>
                    <div>
                      <span className="text-[9px] text-slate-500 font-mono">RY</span>
                      <Input
                        type="number"
                        step="0.1"
                        value={selectedObjectDef.rotation[1]}
                        onChange={(e) => handleManualRotChange('y', parseFloat(e.target.value) || 0)}
                        className="h-7 text-xs bg-slate-950 border-slate-700 px-1.5 font-mono"
                      />
                    </div>
                    <div>
                      <span className="text-[9px] text-slate-500 font-mono">RZ</span>
                      <Input
                        type="number"
                        step="0.1"
                        value={selectedObjectDef.rotation[2]}
                        onChange={(e) => handleManualRotChange('z', parseFloat(e.target.value) || 0)}
                        className="h-7 text-xs bg-slate-950 border-slate-700 px-1.5 font-mono"
                      />
                    </div>
                  </div>
                </div>

                {/* Acciones para el objeto seleccionado */}
                <div className="flex gap-2 pt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDuplicateObject}
                    className="flex-1 h-8 text-xs gap-1.5 border-slate-700 bg-slate-800 text-slate-200"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    Duplicar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDeleteObject}
                    className="flex-1 h-8 text-xs gap-1.5 border-red-900/60 bg-red-950/40 text-red-400 hover:bg-red-900/60"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Eliminar
                  </Button>
                </div>
              </div>
            ) : (
              <div className="pt-2 border-t border-slate-800 text-center py-4 space-y-2">
                <p className="text-xs text-slate-400">
                  Haga clic sobre cualquier modelo para seleccionarlo y moverlo con el gizmo 3D.
                </p>
                <div className="text-[10px] text-slate-500 space-y-0.5">
                  <p>• Mantenga <strong>[Ctrl]</strong> para alternar a rotación.</p>
                  <p>• Suelte el gizmo para recalcular colisiones BVH.</p>
                </div>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Retícula / Puntero central donde se está apuntando con la cámara */}
      {!loadingAssets && !isEditorActive && !isMenuOpen && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-30 flex items-center justify-center">
          <div
            className={`rounded-full transition-all duration-150 flex items-center justify-center ${
              nearbyPrompt
                ? 'w-6 h-6 border-2 border-primary bg-primary/20 scale-110 shadow-[0_0_12px_rgba(56,189,248,0.6)]'
                : 'w-3 h-3 border border-white/60 bg-white/20 shadow-[0_0_4px_rgba(0,0,0,0.8)]'
            }`}
          >
            <div
              className={`rounded-full transition-colors ${
                nearbyPrompt ? 'w-2 h-2 bg-primary' : 'w-1 h-1 bg-white'
              }`}
            />
          </div>
        </div>
      )}

      {/* HUD: Centro Inferior (Aviso de interaccion contextual y controles) */}
      {!loadingAssets && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-40 flex flex-col items-center gap-2 pointer-events-none">
          {nearbyPrompt && (
            <div className="bg-primary text-primary-foreground font-semibold px-4 py-2 rounded-lg shadow-lg text-xs animate-bounce pointer-events-auto">
              {nearbyPrompt}
            </div>
          )}

          <div className="bg-slate-900/80 backdrop-blur-md border border-slate-800 text-slate-400 px-4 py-1.5 rounded-full text-[11px] flex items-center gap-3">
            <span className="flex items-center gap-1 font-mono">
              <strong className="text-slate-200">WASD</strong> Moverse
            </span>
            <span>•</span>
            <span className="flex items-center gap-1 font-mono">
              <strong className="text-slate-200">Shift</strong> Correr
            </span>
            <span>•</span>
            <span className="flex items-center gap-1 font-mono">
              <strong className="text-slate-200">Espacio</strong> Saltar
            </span>
            <span>•</span>
            <span className="flex items-center gap-1 font-mono">
              <strong className="text-slate-200">Clic</strong> Apuntar
            </span>
            <span>•</span>
            <span className="flex items-center gap-1 font-mono">
              <strong className="text-slate-200">Alt / M</strong> Menu
            </span>
            {import.meta.env.DEV && (
              <>
                <span>•</span>
                <span className="flex items-center gap-1 font-mono text-sky-400">
                  <strong className="text-sky-300">F2</strong> Editor
                </span>
              </>
            )}
            <span>•</span>
            <span className="flex items-center gap-1 font-mono text-primary">
              <strong className="text-primary-foreground bg-primary px-1 rounded text-[10px]">E</strong> Interactuar
            </span>
          </div>
        </div>
      )}

      {/* Indicador de Coordenadas del Jugador en el Mapa */}
      {devCoords && !loadingAssets && (
        <div className="absolute bottom-4 left-4 z-40 pointer-events-none">
          <div className="bg-slate-900/85 backdrop-blur-md border border-slate-800 text-slate-300 px-3 py-1.5 rounded-md text-[11px] font-mono shadow-md">
            <span className="text-slate-400 mr-1.5">[Posición]</span>
            <span>X: <strong className="text-slate-100">{devCoords.x}</strong> Y: <strong className="text-slate-100">{devCoords.y}</strong> Z: <strong className="text-slate-100">{devCoords.z}</strong></span>
          </div>
        </div>
      )}

      {/* Modal / Menu de Opciones al Presionar Alt / M */}
      <Dialog
        open={isMenuOpen}
        onOpenChange={(open) => {
          if (open) {
            openMenu();
          } else {
            handleResumeGame();
          }
        }}
      >
        <DialogContent
          container={gameRootRef.current}
          className="sm:max-w-md bg-slate-900 border-slate-800 text-slate-100 z-50"
        >
          <DialogHeader className="text-center">
            <DialogTitle className="text-lg flex items-center justify-center gap-2">
              <Gamepad2 className="w-5 h-5 text-primary" />
              Menu de Opciones
            </DialogTitle>
            <DialogDescription className="text-slate-400 text-xs">
              Partida: {lobby?.match.name || 'Isla del Pantano'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-4">
            <Button
              onClick={handleResumeGame}
              className="w-full justify-center gap-2 text-sm bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              <Play className="w-4 h-4" />
              Reanudar Juego
            </Button>

            <Button
              variant="outline"
              onClick={handleResetSpawn}
              className="w-full justify-center gap-2 text-sm border-slate-700 bg-slate-800/80 hover:bg-slate-800 text-slate-200"
            >
              <RotateCcw className="w-4 h-4" />
              Restablecer al Punto de Inicio
            </Button>

            <Button
              variant="outline"
              onClick={toggleFullscreen}
              className="w-full justify-center gap-2 text-sm border-slate-700 bg-slate-800/80 hover:bg-slate-800 text-slate-200"
            >
              {isFullscreen ? (
                <>
                  <Minimize2 className="w-4 h-4" />
                  Salir de Pantalla Completa
                </>
              ) : (
                <>
                  <Maximize2 className="w-4 h-4" />
                  Pantalla Completa
                </>
              )}
            </Button>

            <Button
              variant="outline"
              onClick={handleExitGame}
              className="w-full justify-center gap-2 text-sm border-red-900/60 bg-red-950/40 text-red-400 hover:bg-red-900/60 hover:text-red-300"
            >
              <LogOut className="w-4 h-4" />
              Salir de la Partida
            </Button>
          </div>

          <DialogFooter className="text-center sm:justify-center border-t border-slate-800 pt-3">
            <p className="text-[11px] text-slate-500">
              Presione Reanudar o haga clic en el entorno para continuar.
            </p>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default GamePage;
