import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { CircoScene } from '../../game/CircoScene';
import { matchService } from '../../services/match.service';
import { MatchLobbyDetails } from '../../types/match';
import { MapObjectDefinition } from '../../types/map';
import {
  GameLeaderboardHUD,
  GameCoordinatesHUD,
  GameHelpBarHUD,
  MapEditorPanel,
} from '../../components/game/hud';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { LogOut, Maximize2, Minimize2, Sparkles, Tent } from 'lucide-react';
import { toast } from 'sonner';
import { Toaster } from '@/components/ui/sonner';

export const CircoPage: React.FC = () => {
  const { matchId } = useParams<{ matchId: string }>();
  const navigate = useNavigate();

  const gameRootRef = useRef<HTMLDivElement>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const circoSceneRef = useRef<CircoScene | null>(null);

  const [lobby, setLobby] = useState<MatchLobbyDetails | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [playerCoords, setPlayerCoords] = useState<{ x: number; y: number; z: number } | null>(null);

  // Estados de carga de assets 3D
  const [loadingAssets, setLoadingAssets] = useState<boolean>(true);
  const [loadProgress, setLoadProgress] = useState<number>(0);
  const [currentAssetLoading, setCurrentAssetLoading] = useState<string>('Iniciando escenario Circo...');

  // Estados del Editor de Mapas (F2)
  const [isEditorActive, setIsEditorActive] = useState<boolean>(false);
  const [selectedObjectDef, setSelectedObjectDef] = useState<MapObjectDefinition | null>(null);
  const [transformMode, setTransformMode] = useState<'translate' | 'rotate' | 'scale'>('translate');
  const [selectedNewModel, setSelectedNewModel] = useState<string>('FichaPlayer_Rojo.glb');
  const [isSavingMap, setIsSavingMap] = useState<boolean>(false);

  // Cargar datos de la partida y puntajes acumulados
  useEffect(() => {
    if (!matchId) return;

    matchService
      .getMatchLobby(matchId)
      .then((data) => {
        setLobby(data);
      })
      .catch((err) => {
        console.error('[ERROR] Error al consultar datos de partida en el Circo:', err);
      });
  }, [matchId]);

  // Actualizar coordenadas del jugador para el indicador HUD
  useEffect(() => {
    const interval = setInterval(() => {
      if (circoSceneRef.current) {
        const pos = circoSceneRef.current.getPlayerPosition();
        setPlayerCoords({
          x: Number(pos.x.toFixed(2)),
          y: Number(pos.y.toFixed(2)),
          z: Number(pos.z.toFixed(2)),
        });
      }
    }, 150);

    return () => clearInterval(interval);
  }, []);

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

  // Intentar ingresar a pantalla completa automaticamente al cargar o interactuar con la pagina
  useEffect(() => {
    const enterFullscreen = () => {
      if (!document.fullscreenElement) {
        const elem = gameRootRef.current || document.documentElement;
        elem
          .requestFullscreen()
          .then(() => setIsFullscreen(true))
          .catch(() => {});
      }
    };

    // Intentar directamente si la navegacion proviene de un gesto activo de usuario
    if ((navigator as any).userActivation?.hasBeenActive) {
      enterFullscreen();
    }

    // Listener de respaldo para cualquier primer clic o pulsacion de tecla en la ventana
    const handleFirstUserInteraction = () => {
      enterFullscreen();
      window.removeEventListener('click', handleFirstUserInteraction, true);
      window.removeEventListener('keydown', handleFirstUserInteraction, true);
    };

    window.addEventListener('click', handleFirstUserInteraction, true);
    window.addEventListener('keydown', handleFirstUserInteraction, true);

    return () => {
      window.removeEventListener('click', handleFirstUserInteraction, true);
      window.removeEventListener('keydown', handleFirstUserInteraction, true);
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
    };
  }, []);

  const openMenu = useCallback(() => {
    setIsMenuOpen(true);
    if (circoSceneRef.current) {
      circoSceneRef.current.getPlayerController().unlockPointer();
    }
    if (document.pointerLockElement) {
      document.exitPointerLock();
    }
  }, []);

  const handleResumeGame = useCallback(() => {
    setIsMenuOpen(false);
    const canvas = canvasContainerRef.current?.querySelector('canvas');
    if (canvas && !isEditorActive) {
      canvas.requestPointerLock();
    }
  }, [isEditorActive]);

  // Manejar teclado para pausa y deseleccion en editor
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape con editor activo deselecciona objeto
      if (e.code === 'Escape') {
        if (isEditorActive && selectedObjectDef) {
          e.preventDefault();
          circoSceneRef.current?.getMapEditor()?.deselect();
          return;
        }
      }

      // Teclas para alternar menu de opciones en pantalla completa o modo normal
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

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    document.addEventListener('fullscreenchange', handleFullscreenChange);

    return () => {
      window.removeEventListener('keydown', handleKeyDown, { capture: true });
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, [isEditorActive, selectedObjectDef, isMenuOpen, handleResumeGame, openMenu]);

  // Inicializar escena 3D del Circo con carga de modelos
  useEffect(() => {
    if (!canvasContainerRef.current) return;

    const scene = new CircoScene(canvasContainerRef.current);
    circoSceneRef.current = scene;

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

    // Inicializar construccion del mundo (Agua a mitad de rocas Y=-68, CircoBase, Fichas y BVH)
    scene
      .initWorld((progress) => {
        const percent = Math.round((progress.loaded / progress.total) * 100);
        setLoadProgress(percent);
        setCurrentAssetLoading(`Cargando ${progress.currentAsset} (${progress.loaded}/${progress.total})`);
      })
      .then(() => {
        setLoadingAssets(false);
        toast.info('Ha ingresado a la Isla Flotante del Circo.');
      })
      .catch((err) => {
        console.error('[ERROR] Error al inicializar el escenario Circo:', err);
        setLoadingAssets(false);
      });

    return () => {
      scene.dispose();
      circoSceneRef.current = null;
    };
  }, []);

  // Metodos de manipulacion del editor
  const handleToggleEditor = () => {
    if (circoSceneRef.current?.getMapEditor()) {
      circoSceneRef.current.getMapEditor()?.toggleActive();
    }
  };

  const handleSetGizmoMode = (mode: 'translate' | 'rotate' | 'scale') => {
    setTransformMode(mode);
    circoSceneRef.current?.getMapEditor()?.setMode(mode);
  };

  const handleDuplicateObject = () => {
    const editor = circoSceneRef.current?.getMapEditor();
    if (editor) {
      const dup = editor.duplicateSelected();
      if (dup) {
        toast.success(`Objeto duplicado: ${dup.model}`);
      }
    }
  };

  const handleDeleteObject = () => {
    const editor = circoSceneRef.current?.getMapEditor();
    if (editor) {
      const id = selectedObjectDef?.id;
      if (editor.deleteSelected()) {
        toast.info(`Objeto eliminado del mapa: ${id}`);
      }
    }
  };

  const handleAddNewObject = () => {
    const editor = circoSceneRef.current?.getMapEditor();
    if (editor) {
      const cat = selectedNewModel.startsWith('Circo') ? 'structure' : 'prop';
      const added = editor.addNewObject(selectedNewModel, cat);
      if (added) {
        toast.success(`Nueva instancia agregada: ${selectedNewModel}`);
      }
    }
  };

  const handleSaveMap = async () => {
    const editor = circoSceneRef.current?.getMapEditor();
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

    circoSceneRef.current?.getMapEditor()?.updateSelectedTransform(current);
  };

  const handleManualRotChange = (axis: 'x' | 'y' | 'z', value: number) => {
    if (!selectedObjectDef) return;
    const current = [...selectedObjectDef.rotation] as [number, number, number];
    if (axis === 'x') current[0] = value;
    if (axis === 'y') current[1] = value;
    if (axis === 'z') current[2] = value;

    circoSceneRef.current?.getMapEditor()?.updateSelectedTransform(undefined, current);
  };

  const availableModels = circoSceneRef.current?.getMapEditor()?.getAvailableModels() || [
    'Flecha.glb',
    'FichaPlayer_Amarillo.glb',
    'FichaPlayer_AmarilloClaro.glb',
    'FichaPlayer_Azul.glb',
    'FichaPlayer_MoradoClaro.glb',
    'FichaPlayer_Rojo.glb',
    'FichaPlayer_VerdeClaro.glb',
    'CircoBase.glb',
  ];

  // Ordenar equipos por puntuacion acumulada
  const sortedTeams = lobby?.teams ? [...lobby.teams].sort((a: any, b: any) => (b.score || 0) - (a.score || 0)) : [];

  return (
    <div
      ref={gameRootRef}
      className="fixed inset-0 w-screen h-screen overflow-hidden select-none bg-slate-950 font-sans z-50"
    >
      {/* Canvas 3D de Three.js */}
      <div
        ref={canvasContainerRef}
        className="w-full h-full cursor-crosshair"
        onClick={() => {
          if (!document.fullscreenElement) {
            const elem = gameRootRef.current || document.documentElement;
            elem.requestFullscreen().catch(() => {});
          }
          if (!isMenuOpen && !isEditorActive) {
            const canvas = canvasContainerRef.current?.querySelector('canvas');
            canvas?.requestPointerLock();
          }
        }}
      />

      <Toaster position="top-right" richColors />

      {/* Pantalla de carga superpuesta mientras se descargan e instancian los GLB */}
      {loadingAssets && (
        <div className="absolute inset-0 bg-slate-950 flex flex-col items-center justify-center p-6 z-50">
          <Card className="w-full max-w-md border-slate-800 bg-slate-900 shadow-2xl">
            <CardHeader className="text-center space-y-2">
              <div className="inline-flex items-center justify-center p-3 bg-amber-500/10 rounded-2xl text-amber-400 mx-auto">
                <Tent className="w-8 h-8 text-amber-400" />
              </div>
              <CardTitle className="text-xl text-slate-100">
                Cargando Isla del Circo
              </CardTitle>
              <p className="text-xs text-slate-400">
                Arena Flotante - Plataforma de Gamificacion
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

      {/* Reticula central */}
      {!loadingAssets && (
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
          <div className="relative w-4 h-4 flex items-center justify-center">
            <div className="w-1.5 h-1.5 rounded-full bg-amber-400 opacity-80" />
          </div>
        </div>
      )}

      {/* Banner superior de estado */}
      {!loadingAssets && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-2 pointer-events-none">
          <Badge variant="secondary" className="bg-slate-900/90 text-amber-400 border-amber-500/40 text-sm px-3 py-1">
            <Sparkles className="w-4 h-4 mr-1.5 inline" />
            Escenario Circo (Isla Flotante)
          </Badge>
        </div>
      )}

      {/* Botones de control superior derecho */}
      {!loadingAssets && (
        <div className="absolute top-4 right-4 flex items-center gap-2 pointer-events-auto">
          <Button
            size="sm"
            variant="outline"
            onClick={openMenu}
            className="bg-slate-900/80 border-slate-700 text-slate-200 hover:bg-slate-800 text-xs gap-1.5"
          >
            Menu (Alt)
          </Button>
          <Button
            size="icon"
            variant="outline"
            onClick={toggleFullscreen}
            className="w-8 h-8 bg-slate-900/80 border-slate-700 text-slate-200 hover:bg-slate-800"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </Button>
        </div>
      )}

      {/* Tabla de posiciones flotante lateral izquierda */}
      {!loadingAssets && (
        <GameLeaderboardHUD
          stageName="Circo"
          matchName={lobby?.match.name || matchId}
          teams={sortedTeams}
          showEditorButton={import.meta.env.DEV}
          isEditorActive={isEditorActive}
          onToggleEditor={handleToggleEditor}
          onOpenMenu={openMenu}
        />
      )}

      {/* Panel del Editor de Mapas (DEV y F2) */}
      {import.meta.env.DEV && (
        <MapEditorPanel
          isEditorActive={isEditorActive}
          selectedObjectDef={selectedObjectDef}
          transformMode={transformMode}
          isSavingMap={isSavingMap}
          availableModels={availableModels}
          selectedNewModel={selectedNewModel}
          mapFileName="circo-map.json"
          onToggleEditor={handleToggleEditor}
          onSetGizmoMode={handleSetGizmoMode}
          onDeselect={() => circoSceneRef.current?.getMapEditor()?.deselect()}
          onDuplicate={handleDuplicateObject}
          onDelete={handleDeleteObject}
          onAddNew={handleAddNewObject}
          onSaveMap={handleSaveMap}
          onManualCoordChange={handleManualCoordChange}
          onManualRotChange={handleManualRotChange}
          onSelectModelChange={setSelectedNewModel}
        />
      )}

      {/* Controles en barra inferior */}
      {!loadingAssets && (
        <GameHelpBarHUD showInteractKey={false} />
      )}

      {/* Coordenadas en esquina inferior izquierda */}
      {!loadingAssets && (
        <GameCoordinatesHUD coords={playerCoords} />
      )}

      {/* Dialogo modal de pausa */}
      <Dialog open={isMenuOpen} onOpenChange={setIsMenuOpen}>
        <DialogContent
          container={gameRootRef.current}
          className="bg-slate-900 border-slate-800 text-slate-100 max-w-sm"
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              Escenario Circo
            </DialogTitle>
            <DialogDescription className="text-slate-400 text-xs">
              Partida: {lobby?.match.name || matchId}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-3">
            <Button
              className="w-full bg-amber-600 hover:bg-amber-700 text-white"
              onClick={handleResumeGame}
            >
              Reanudar juego
            </Button>
            <Button
              variant="outline"
              className="w-full border-slate-700 text-slate-300 hover:bg-slate-800"
              onClick={() => {
                circoSceneRef.current?.resetPlayerSpawn();
                toast.info('Posicion restablecida al spawn de la carpa.');
                handleResumeGame();
              }}
            >
              Restablecer posicion
            </Button>
            <Button
              variant="outline"
              className="w-full border-slate-700 text-slate-300 hover:bg-slate-800"
              onClick={toggleFullscreen}
            >
              {isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
            </Button>
            <Button
              variant="destructive"
              className="w-full gap-2"
              onClick={() => {
                if (document.fullscreenElement) {
                  document.exitFullscreen().catch(() => {});
                }
                navigate('/matches');
              }}
            >
              <LogOut className="w-4 h-4" />
              Salir a salas
            </Button>
          </div>

          <DialogFooter className="text-xs text-slate-500 justify-center">
            Presione Alt para cerrar este menu
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CircoPage;
