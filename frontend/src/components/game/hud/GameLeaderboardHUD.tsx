import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Trophy, Sliders, Settings } from 'lucide-react';

export interface LeaderboardTeamItem {
  id?: string;
  teamId?: string;
  name: string;
  score?: number;
  color?: string;
  cardsCount?: number;
  [key: string]: any;
}

export interface GameLeaderboardHUDProps {
  stageName?: string;
  matchName?: string;
  teams: LeaderboardTeamItem[];
  myTeamId?: string;
  portalStatus?: {
    active: boolean;
    count: number;
    maxCount?: number;
    label?: string;
  };
  showEditorButton?: boolean;
  isEditorActive?: boolean;
  onToggleEditor?: () => void;
  onOpenMenu?: () => void;
  extraActions?: React.ReactNode;
  className?: string;
}

/**
 * Componente reutilizable para la Tabla de Posiciones flotante en minijuegos y escenarios 3D.
 */
export const GameLeaderboardHUD: React.FC<GameLeaderboardHUDProps> = ({
  stageName = 'Pantano',
  matchName,
  teams,
  myTeamId,
  portalStatus,
  showEditorButton = false,
  isEditorActive = false,
  onToggleEditor,
  onOpenMenu,
  extraActions,
  className = '',
}) => {
  return (
    <div className={`absolute left-4 top-1/2 -translate-y-1/2 z-40 pointer-events-none w-72 ${className}`}>
      <Card className="bg-slate-900/90 backdrop-blur-md border-slate-800 shadow-2xl pointer-events-auto p-3.5 space-y-3">
        {/* Encabezado: Titulo de Tabla y Escenario */}
        <div className="border-b border-slate-800 pb-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
              <Trophy className="w-3.5 h-3.5" />
              Tabla de Posiciones
            </span>
            {stageName && (
              <Badge variant="outline" className="text-[10px] text-slate-400 border-slate-700">
                {stageName}
              </Badge>
            )}
          </div>
          {matchName && (
            <p className="text-[11px] text-slate-400 truncate mt-1">
              Partida: <strong className="text-slate-200">{matchName}</strong>
            </p>
          )}
        </div>

        {/* Lista de Equipos en la Tabla de Posiciones */}
        <div className="space-y-1.5 text-xs max-h-48 overflow-y-auto pr-0.5">
          {teams && teams.length > 0 ? (
            teams.map((team, idx) => {
              const currentId = team.teamId || team.id;
              const isMyTeam = myTeamId && currentId === myTeamId;
              const color =
                team.color ||
                ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'][idx % 6];

              return (
                <div
                  key={currentId || `team-${idx}`}
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
                      style={{ backgroundColor: color }}
                    />
                    <span className="truncate">{team.name}</span>
                    {isMyTeam && (
                      <span className="text-[9px] font-bold text-primary-foreground bg-primary px-1.5 py-0.5 rounded-full shrink-0 ml-1">
                        Tu equipo
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {team.cardsCount !== undefined && (
                      <span className="text-[11px] text-slate-400 font-mono">
                        {team.cardsCount}/4
                      </span>
                    )}
                    <Badge
                      variant="outline"
                      className="text-[10px] font-mono px-1.5 py-0 border-amber-500/30 text-amber-300"
                    >
                      {team.score || 0} pts
                    </Badge>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-slate-500 text-center py-2 text-[11px]">Sincronizando equipos...</div>
          )}
        </div>

        {/* Estado del Portal del Equipo si aplica */}
        {portalStatus && (
          <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs">
            <span className="text-slate-400">{portalStatus.label || 'Portal de tu equipo:'}</span>
            <Badge
              variant={portalStatus.active ? 'default' : 'outline'}
              className={
                portalStatus.active
                  ? 'animate-pulse text-[10px] bg-emerald-600 text-white font-medium'
                  : 'text-slate-500 border-slate-700 text-[10px]'
              }
            >
              {portalStatus.active
                ? 'Activo (Presione E)'
                : `Bloqueado (${portalStatus.count}/${portalStatus.maxCount || 4})`}
            </Badge>
          </div>
        )}

        {/* Botones de Accion: Editor [F2], Menu (Alt / M) */}
        {(showEditorButton || onOpenMenu || extraActions) && (
          <div className="pt-2 border-t border-slate-800 space-y-1.5">
            {showEditorButton && onToggleEditor && (
              <Button
                variant={isEditorActive ? 'default' : 'outline'}
                size="sm"
                onClick={onToggleEditor}
                className="w-full h-7 text-[11px] gap-1.5"
                title="Alternar Editor de Mapas (F2)"
              >
                <Sliders className="w-3 h-3" />
                Editor [F2]
              </Button>
            )}
            {onOpenMenu && (
              <Button
                variant="outline"
                size="sm"
                onClick={onOpenMenu}
                className="w-full h-8 text-xs gap-1.5 bg-slate-800/80 hover:bg-slate-700 border-slate-700 text-slate-200"
                title="Pausar y abrir menu (Alt o M)"
              >
                <Settings className="w-3.5 h-3.5" />
                Menu (Alt / M)
              </Button>
            )}
            {extraActions}
          </div>
        )}
      </Card>
    </div>
  );
};
