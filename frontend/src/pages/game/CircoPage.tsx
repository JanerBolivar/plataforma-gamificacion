import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { CircoScene } from '../../game/CircoScene';
import { matchService } from '../../services/match.service';
import { MatchLobbyDetails } from '../../types/match';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
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
import { Trophy, LogOut, Maximize2, Minimize2, Sparkles } from 'lucide-react';
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

  // Inicializar escena 3D del Circo
  useEffect(() => {
    if (!canvasContainerRef.current) return;

    const scene = new CircoScene(canvasContainerRef.current);
    circoSceneRef.current = scene;

    toast.info('Ha ingresado al escenario Circo.');

    return () => {
      scene.dispose();
      circoSceneRef.current = null;
    };
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
    if (canvas) {
      canvas.requestPointerLock();
    }
  }, []);

  // Manejar tecla Alt para pausa
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'AltLeft' || e.code === 'AltRight' || e.key === 'Alt') {
        e.preventDefault();
        if (isMenuOpen) {
          handleResumeGame();
        } else {
          openMenu();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => {
      window.removeEventListener('keydown', handleKeyDown, { capture: true });
    };
  }, [isMenuOpen, handleResumeGame, openMenu]);

  // Ordenar equipos por puntuacion acumulada
  const sortedTeams = lobby?.teams ? [...lobby.teams].sort((a: any, b: any) => (b.score || 0) - (a.score || 0)) : [];

  return (
    <div
      ref={gameRootRef}
      className="relative w-screen h-screen overflow-hidden select-none bg-slate-950 font-sans"
    >
      {/* Canvas 3D */}
      <div
        ref={canvasContainerRef}
        className="w-full h-full cursor-crosshair"
        onClick={() => {
          if (!isMenuOpen) {
            const canvas = canvasContainerRef.current?.querySelector('canvas');
            canvas?.requestPointerLock();
          }
        }}
      />

      <Toaster position="top-right" richColors />

      {/* Reticula central */}
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
        <div className="relative w-4 h-4 flex items-center justify-center">
          <div className="w-1.5 h-1.5 rounded-full bg-amber-400 opacity-80" />
        </div>
      </div>

      {/* Banner superior de estado */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-2 pointer-events-none">
        <Badge variant="secondary" className="bg-slate-900/90 text-amber-400 border-amber-500/40 text-sm px-3 py-1">
          <Sparkles className="w-4 h-4 mr-1.5 inline" />
          Escenario Circo (Fase 5 - En desarrollo)
        </Badge>
      </div>

      {/* Botones de control superior derecho */}
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

      {/* Tabla de posiciones flotante superior izquierda */}
      <div className="absolute top-4 left-4 w-64 pointer-events-none">
        <Card className="bg-slate-950/85 border-slate-800 text-slate-100 backdrop-blur-sm shadow-xl">
          <CardHeader className="p-3 pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-semibold flex items-center gap-1.5 text-amber-400">
              <Trophy className="w-3.5 h-3.5" />
              Puntuacion Acumulada
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="space-y-1.5 text-xs">
              {sortedTeams.length > 0 ? (
                sortedTeams.map((team: any, index) => (
                  <div
                    key={team.id}
                    className="flex items-center justify-between py-1 border-b border-slate-800/60 last:border-0"
                  >
                    <span className="flex items-center gap-1.5 truncate">
                      <span className="font-bold text-slate-400">#{index + 1}</span>
                      <span className="truncate">{team.name}</span>
                    </span>
                    <Badge variant="outline" className="text-xs font-mono font-bold border-amber-500/30 text-amber-300">
                      {team.score || 0} pts
                    </Badge>
                  </div>
                ))
              ) : (
                <div className="text-slate-500 text-center py-2">Sin equipos registrados</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Controles en barra inferior */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 pointer-events-none">
        <div className="bg-slate-900/80 border border-slate-800 px-4 py-1.5 rounded-full text-xs text-slate-400 backdrop-blur-sm">
          WASD Moverse · Shift Correr · Espacio Saltar · Clic Apuntar · Alt Menu
        </div>
      </div>

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
              onClick={toggleFullscreen}
            >
              {isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
            </Button>
            <Button
              variant="destructive"
              className="w-full gap-2"
              onClick={() => {
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
