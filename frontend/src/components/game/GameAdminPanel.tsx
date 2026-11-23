import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import {
  ShieldAlert,
  Users,
  Sparkles,
  Compass,
  Navigation,
  TreePine,
  Tent,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  RefreshCw,
  Plus,
  Loader2,
  MapPin,
} from 'lucide-react';

export interface ConnectedUserItem {
  sessionId: string;
  userId: string;
  fullName: string;
  teamName: string;
  teamColor?: string;
  x: number;
  y: number;
  z: number;
}

export interface LandmarkPoint {
  label: string;
  x: number;
  y: number;
  z: number;
}

export interface GameAdminPanelProps {
  matchId: string;
  currentStage: 'SWAMP' | 'CIRCO';
  connectedUsers: ConnectedUserItem[];
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  onTeleportTo: (x: number, y: number, z: number, label?: string) => void;
  onSwitchStage: (stage: 'SWAMP' | 'CIRCO') => void;
  onSpawnCollectible?: (type: string) => Promise<void>;
  onRegenerateCollectibles?: () => Promise<void>;
}

const SWAMP_LANDMARKS: LandmarkPoint[] = [
  { label: 'Choza Inicial (Spawn)', x: 12.5, y: 3.9, z: 90.0 },
  { label: 'Portal Dimensional (NE)', x: 60.0, y: 4.0, z: -75.0 },
  { label: 'Centro del Pantano', x: 0.0, y: 3.0, z: 0.0 },
  { label: 'Zona Noroeste', x: -65.0, y: 3.5, z: -65.0 },
  { label: 'Zona Sureste', x: 70.0, y: 3.5, z: 70.0 },
];

const CIRCO_LANDMARKS: LandmarkPoint[] = [
  { label: 'Puente de Entrada', x: 36.42, y: -14.85, z: 120.52 },
  { label: 'Ruleta Central', x: 36.5, y: -7.5, z: 5.0 },
  { label: 'Atril Puesto 1', x: -6.3, y: -7.5, z: -0.6 },
  { label: 'Atril Puesto 2', x: 10.8, y: -7.5, z: -9.4 },
  { label: 'Gradas de Espectadores', x: 36.13, y: -7.5, z: -18.0 },
];

const COLLECTIBLE_TYPES = [
  { key: 'TIBURON_AZUL', label: 'Tiburón Azul' },
  { key: 'TIBURON_ROJO', label: 'Tiburón Rojo' },
  { key: 'ADIVINALO', label: 'Adivínalo' },
  { key: 'CARTA_PREGUNTA', label: 'Carta Pregunta' },
];

/**
 * Panel lateral flotante reutilizable para herramientas de administracion en tiempo de juego.
 */
export const GameAdminPanel: React.FC<GameAdminPanelProps> = ({
  currentStage,
  connectedUsers,
  isOpen: propIsOpen,
  onOpenChange,
  onTeleportTo,
  onSwitchStage,
  onSpawnCollectible,
  onRegenerateCollectibles,
}) => {
  const [internalOpen, setInternalOpen] = useState<boolean>(false);
  const isOpen = propIsOpen !== undefined ? propIsOpen : internalOpen;

  const handleSetOpen = (open: boolean) => {
    if (open) {
      if (document.pointerLockElement) {
        document.exitPointerLock?.();
      }
    }
    if (propIsOpen === undefined) {
      setInternalOpen(open);
    }
    onOpenChange?.(open);
  };

  const [isUsersOpen, setIsUsersOpen] = useState<boolean>(true);
  const [isCollectiblesOpen, setIsCollectiblesOpen] = useState<boolean>(true);
  const [isTeleportOpen, setIsTeleportOpen] = useState<boolean>(false);

  const [selectedCollectibleType, setSelectedCollectibleType] = useState<string>('TIBURON_AZUL');
  const [isSpawning, setIsSpawning] = useState<boolean>(false);
  const [isRegenerating, setIsRegenerating] = useState<boolean>(false);

  // Liberar pointer lock automaticamente cuando el panel se abra
  useEffect(() => {
    if (isOpen) {
      if (document.pointerLockElement) {
        document.exitPointerLock?.();
      }
    }
  }, [isOpen]);

  // Atajo de teclado: Tecla '.' (Period) para alternar el panel y activar el cursor
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignorar si el usuario esta escribiendo en un input, textarea o select
      const target = e.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable) {
          return;
        }
      }

      if (e.key === '.' || e.code === 'Period') {
        e.preventDefault();
        e.stopPropagation();
        handleSetOpen(!isOpen);
      }
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => {
      window.removeEventListener('keydown', handleKeyDown, { capture: true });
    };
  }, [isOpen, onOpenChange]);

  // Liberar pointer lock al interactuar con el panel de administracion
  const handleInteraction = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (document.pointerLockElement) {
      document.exitPointerLock?.();
    }
  };

  const handleSpawn = async () => {
    if (!onSpawnCollectible || isSpawning) return;
    setIsSpawning(true);
    try {
      await onSpawnCollectible(selectedCollectibleType);
    } catch {
      // El error se maneja en el callback
    } finally {
      setIsSpawning(false);
    }
  };

  const handleRegenerate = async () => {
    if (!onRegenerateCollectibles || isRegenerating) return;
    setIsRegenerating(true);
    try {
      await onRegenerateCollectibles();
    } catch {
      // El error se maneja en el callback
    } finally {
      setIsRegenerating(false);
    }
  };

  const landmarks = currentStage === 'SWAMP' ? SWAMP_LANDMARKS : CIRCO_LANDMARKS;

  if (!isOpen) {
    return (
      <div
        className="fixed right-4 top-20 z-50 pointer-events-auto select-none"
        onMouseEnter={handleInteraction}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={handleInteraction}
      >
        <Button
          size="sm"
          variant="outline"
          onClick={() => handleSetOpen(true)}
          className="bg-slate-900/90 border-purple-500/60 hover:border-purple-400 text-purple-300 hover:text-white shadow-xl shadow-purple-950/40 backdrop-blur-md gap-2 h-9 px-3 text-xs transition-all"
          title="Abrir panel de administración (Tecla: .)"
        >
          <ShieldAlert className="h-4 w-4 text-purple-400 animate-pulse" />
          <span className="font-semibold tracking-wide">Modo Admin</span>
          <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-purple-950/90 border border-purple-700/80 text-purple-300 rounded leading-none">
            .
          </kbd>
          <Badge className="bg-purple-950/90 text-purple-300 border border-purple-800 text-[10px] px-1.5 py-0 h-4">
            ADMIN
          </Badge>
          <ChevronLeft className="h-4 w-4 text-slate-400" />
        </Button>
      </div>
    );
  }

  return (
    <div
      className="fixed right-4 top-20 z-50 pointer-events-auto select-none"
      onMouseEnter={handleInteraction}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={handleInteraction}
    >
      <Card className="w-80 max-h-[82vh] flex flex-col bg-slate-900/95 border border-purple-900/60 rounded-xl shadow-2xl shadow-purple-950/60 backdrop-blur-md text-slate-100 overflow-hidden">
        {/* Cabecera del Panel */}
        <CardHeader className="p-3 border-b border-slate-800 flex flex-row items-center justify-between space-y-0">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-purple-400 shrink-0" />
            <div>
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-purple-200">
                Panel de Administrador
              </CardTitle>
              <div className="flex items-center gap-1.5 mt-0.5">
                <Badge
                  variant="outline"
                  className={
                    currentStage === 'SWAMP'
                      ? 'border-emerald-600/70 text-emerald-400 bg-emerald-950/40 text-[10px] py-0 px-1.5'
                      : 'border-amber-600/70 text-amber-400 bg-amber-950/40 text-[10px] py-0 px-1.5'
                  }
                >
                  {currentStage === 'SWAMP' ? 'Isla Pantano' : 'Isla Circo'}
                </Badge>
                <span className="text-[10px] text-slate-400">Control Global</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <kbd
              className="px-1.5 py-0.5 text-[10px] font-mono bg-slate-800 border border-slate-700 text-slate-300 rounded leading-none"
              title="Atajo para alternar panel"
            >
              .
            </kbd>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => handleSetOpen(false)}
              className="h-6 w-6 text-slate-400 hover:text-white hover:bg-slate-800"
              title="Cerrar panel (.)"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>

        {/* Contenido scrolleable */}
        <CardContent className="p-3 space-y-3 overflow-y-auto max-h-[calc(82vh-58px)] text-xs">
          {/* Seccion 1: Usuarios Conectados */}
          <div className="border border-slate-800 rounded-lg overflow-hidden bg-slate-950/40">
            <button
              type="button"
              onClick={() => setIsUsersOpen((prev) => !prev)}
              className="w-full flex items-center justify-between p-2.5 bg-slate-900/80 hover:bg-slate-850 text-left font-medium text-slate-200 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Users className="h-3.5 w-3.5 text-cyan-400" />
                <span>Usuarios Conectados</span>
                <Badge
                  variant="secondary"
                  className="bg-cyan-950 text-cyan-300 border border-cyan-800/80 text-[10px] px-1.5 py-0 h-4"
                >
                  {connectedUsers.length}
                </Badge>
              </div>
              <ChevronDown
                className={`h-3.5 w-3.5 text-slate-400 transition-transform ${
                  isUsersOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            {isUsersOpen && (
              <div className="p-2 space-y-1.5 border-t border-slate-800 max-h-48 overflow-y-auto">
                {connectedUsers.length === 0 ? (
                  <p className="text-[11px] text-slate-400 italic text-center py-2">
                    No hay otros jugadores remotos conectados.
                  </p>
                ) : (
                  connectedUsers.map((u) => (
                    <div
                      key={u.sessionId}
                      className="flex items-center justify-between p-1.5 rounded bg-slate-900/60 border border-slate-800/80 hover:border-slate-700 transition-all gap-2"
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm"
                          style={{ backgroundColor: u.teamColor || '#3b82f6' }}
                          title={u.teamName}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-slate-200 truncate">
                            {u.fullName}
                          </p>
                          <p className="text-[10px] text-slate-400 truncate">
                            {u.teamName} · ({u.x}, {u.z})
                          </p>
                        </div>
                      </div>

                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => onTeleportTo(u.x, u.y, u.z, u.fullName)}
                        className="h-6 px-2 text-[10px] bg-purple-950/80 hover:bg-purple-900 text-purple-200 border border-purple-800 shrink-0 gap-1"
                        title={`Teletransportarse a la posición de ${u.fullName}`}
                      >
                        <Navigation className="h-3 w-3" />
                        TP
                      </Button>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Seccion 2: Regenerar Objetos (Solo en Pantano) */}
          {currentStage === 'SWAMP' && (
            <div className="border border-slate-800 rounded-lg overflow-hidden bg-slate-950/40">
              <button
                type="button"
                onClick={() => setIsCollectiblesOpen((prev) => !prev)}
                className="w-full flex items-center justify-between p-2.5 bg-slate-900/80 hover:bg-slate-850 text-left font-medium text-slate-200 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                  <span>Regenerar Objetos (Pantano)</span>
                </div>
                <ChevronDown
                  className={`h-3.5 w-3.5 text-slate-400 transition-transform ${
                    isCollectiblesOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {isCollectiblesOpen && (
                <div className="p-2.5 space-y-2.5 border-t border-slate-800">
                  <p className="text-[11px] text-slate-400 leading-tight">
                    Genera cartas en el terreno respetando las zonas seguras y límites de exclusión.
                  </p>

                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-slate-300 uppercase tracking-wider">
                      Tipo de Carta a Generar:
                    </label>
                    <select
                      value={selectedCollectibleType}
                      onChange={(e) => setSelectedCollectibleType(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-purple-500"
                    >
                      {COLLECTIBLE_TYPES.map((t) => (
                        <option key={t.key} value={t.key}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-col gap-1.5 pt-1">
                    <Button
                      size="sm"
                      onClick={handleSpawn}
                      disabled={isSpawning || isRegenerating}
                      className="w-full h-7 bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold gap-1.5 shadow"
                    >
                      {isSpawning ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          Generando...
                        </>
                      ) : (
                        <>
                          <Plus className="h-3.5 w-3.5" />
                          Generar Objeto
                        </>
                      )}
                    </Button>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleRegenerate}
                      disabled={isSpawning || isRegenerating}
                      className="w-full h-7 border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs gap-1.5"
                    >
                      {isRegenerating ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin text-cyan-400" />
                          Regenerando...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="h-3.5 w-3.5 text-cyan-400" />
                          Regenerar Todo el Mapa
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Seccion 3: Teletransporte y Escenarios */}
          <div className="border border-slate-800 rounded-lg overflow-hidden bg-slate-950/40">
            <button
              type="button"
              onClick={() => setIsTeleportOpen((prev) => !prev)}
              className="w-full flex items-center justify-between p-2.5 bg-slate-900/80 hover:bg-slate-850 text-left font-medium text-slate-200 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Compass className="h-3.5 w-3.5 text-purple-400" />
                <span>Teletransporte y Escenarios</span>
              </div>
              <ChevronDown
                className={`h-3.5 w-3.5 text-slate-400 transition-transform ${
                  isTeleportOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            {isTeleportOpen && (
              <div className="p-2.5 space-y-2.5 border-t border-slate-800">
                {/* Cambiar de Isla */}
                <div>
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                    Moverse entre Islas:
                  </p>
                  <div className="grid grid-cols-2 gap-1.5">
                    <Button
                      size="sm"
                      variant={currentStage === 'SWAMP' ? 'secondary' : 'outline'}
                      onClick={() => onSwitchStage('SWAMP')}
                      disabled={currentStage === 'SWAMP'}
                      className={`h-7 text-xs gap-1.5 ${
                        currentStage === 'SWAMP'
                          ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800 opacity-60'
                          : 'border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-200'
                      }`}
                    >
                      <TreePine className="h-3.5 w-3.5 text-emerald-400" />
                      Pantano
                    </Button>

                    <Button
                      size="sm"
                      variant={currentStage === 'CIRCO' ? 'secondary' : 'outline'}
                      onClick={() => onSwitchStage('CIRCO')}
                      disabled={currentStage === 'CIRCO'}
                      className={`h-7 text-xs gap-1.5 ${
                        currentStage === 'CIRCO'
                          ? 'bg-amber-950/80 text-amber-300 border border-amber-800 opacity-60'
                          : 'border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-200'
                      }`}
                    >
                      <Tent className="h-3.5 w-3.5 text-amber-400" />
                      Circo
                    </Button>
                  </div>
                </div>

                {/* Puntos clave del escenario */}
                <div>
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                    Puntos Clave ({currentStage === 'SWAMP' ? 'Pantano' : 'Circo'}):
                  </p>
                  <div className="flex flex-col gap-1 max-h-36 overflow-y-auto">
                    {landmarks.map((lm, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => onTeleportTo(lm.x, lm.y, lm.z, lm.label)}
                        className="flex items-center justify-between p-1.5 rounded bg-slate-900/60 hover:bg-purple-950/40 border border-slate-800/80 hover:border-purple-800/80 text-left text-slate-200 transition-all group"
                      >
                        <span className="truncate pr-1 text-[11px] group-hover:text-purple-200">
                          {lm.label}
                        </span>
                        <span className="text-[10px] font-mono text-slate-500 group-hover:text-purple-300 shrink-0 flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          TP
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
