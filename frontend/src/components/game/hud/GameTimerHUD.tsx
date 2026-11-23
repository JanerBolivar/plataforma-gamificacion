import React from 'react';
import { Clock } from 'lucide-react';

export interface GameTimerHUDProps {
  timeRemaining: number;
  warningThreshold?: number;
  label?: string;
  className?: string;
}

/**
 * Componente reutilizable para el Temporizador flotante superior en escenarios de juego.
 */
export const GameTimerHUD: React.FC<GameTimerHUDProps> = ({
  timeRemaining,
  warningThreshold = 60,
  label,
  className = '',
}) => {
  const isWarning = timeRemaining < warningThreshold;
  const minutes = Math.floor(Math.max(0, timeRemaining) / 60);
  const seconds = Math.floor(Math.max(0, timeRemaining) % 60);

  return (
    <div className={`absolute top-4 left-1/2 -translate-x-1/2 z-40 pointer-events-none ${className}`}>
      <div
        className={`px-4 py-1.5 rounded-full border backdrop-blur-md shadow-xl flex items-center gap-2 pointer-events-auto transition-colors ${
          isWarning
            ? 'bg-red-950/95 border-red-500/70 text-red-200 animate-pulse'
            : 'bg-slate-900/95 border-amber-500/50 text-amber-300'
        }`}
      >
        <Clock className={`w-4 h-4 ${isWarning ? 'text-red-400' : 'text-amber-400'}`} />
        <span className="font-mono font-bold text-sm tracking-wider text-slate-100">
          {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
        </span>
        {label && (
          <span className="text-xs font-medium text-slate-300 border-l border-slate-700 pl-2 max-w-xs truncate">
            {label}
          </span>
        )}
      </div>
    </div>
  );
};
