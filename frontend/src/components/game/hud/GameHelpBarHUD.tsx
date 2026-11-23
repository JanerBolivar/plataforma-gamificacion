import React from 'react';

export interface GameHelpControl {
  key: string;
  label: string;
  highlight?: boolean;
}

export interface GameHelpBarHUDProps {
  nearbyPrompt?: string | null;
  showEditorKey?: boolean;
  showInteractKey?: boolean;
  interactLabel?: string;
  customControls?: GameHelpControl[];
  className?: string;
}

/**
 * Componente reutilizable para la barra inferior de ayuda y atajos de teclado.
 */
export const GameHelpBarHUD: React.FC<GameHelpBarHUDProps> = ({
  nearbyPrompt,
  showEditorKey = false,
  showInteractKey = true,
  interactLabel = 'Interactuar',
  customControls,
  className = '',
}) => {
  return (
    <div className={`absolute bottom-6 left-1/2 -translate-x-1/2 z-40 flex flex-col items-center gap-2 pointer-events-none ${className}`}>
      {nearbyPrompt && (
        <div className="bg-primary text-primary-foreground font-semibold px-4 py-2 rounded-lg shadow-lg text-xs animate-bounce pointer-events-auto">
          {nearbyPrompt}
        </div>
      )}

      <div className="bg-slate-900/80 backdrop-blur-md border border-slate-800 text-slate-400 px-4 py-1.5 rounded-full text-[11px] flex items-center gap-3">
        {customControls ? (
          customControls.map((ctrl, i) => (
            <React.Fragment key={ctrl.key}>
              {i > 0 && <span>•</span>}
              <span className="flex items-center gap-1 font-mono">
                <strong
                  className={
                    ctrl.highlight
                      ? 'text-primary-foreground bg-primary px-1 rounded text-[10px]'
                      : 'text-slate-200'
                  }
                >
                  {ctrl.key}
                </strong>{' '}
                {ctrl.label}
              </span>
            </React.Fragment>
          ))
        ) : (
          <>
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
            {showEditorKey && (
              <>
                <span>•</span>
                <span className="flex items-center gap-1 font-mono text-sky-400">
                  <strong className="text-sky-300">F2</strong> Editor
                </span>
              </>
            )}
            {showInteractKey && (
              <>
                <span>•</span>
                <span className="flex items-center gap-1 font-mono text-primary">
                  <strong className="text-primary-foreground bg-primary px-1 rounded text-[10px]">E</strong>{' '}
                  {interactLabel}
                </span>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
};
