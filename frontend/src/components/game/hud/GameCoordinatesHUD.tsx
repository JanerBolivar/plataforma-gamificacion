import React from 'react';

export interface GameCoordinatesHUDProps {
  coords?: { x: number; y: number; z: number } | null;
  className?: string;
}

/**
 * Componente reutilizable para el indicador de coordenadas (X, Y, Z) en la esquina inferior izquierda.
 */
export const GameCoordinatesHUD: React.FC<GameCoordinatesHUDProps> = ({
  coords,
  className = '',
}) => {
  if (!coords) return null;

  return (
    <div className={`absolute bottom-4 left-4 z-40 pointer-events-none ${className}`}>
      <div className="bg-slate-900/85 backdrop-blur-md border border-slate-800 text-slate-300 px-3 py-1.5 rounded-md text-[11px] font-mono shadow-md">
        <span className="text-slate-400 mr-1.5">[Posición]</span>
        <span>
          X: <strong className="text-slate-100">{coords.x}</strong> Y:{' '}
          <strong className="text-slate-100">{coords.y}</strong> Z:{' '}
          <strong className="text-slate-100">{coords.z}</strong>
        </span>
      </div>
    </div>
  );
};
