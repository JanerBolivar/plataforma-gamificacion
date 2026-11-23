import React from 'react';
import { MapObjectDefinition } from '../../../types/map';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sliders,
  X,
  Save,
  Move,
  RotateCw,
  Maximize2,
  Copy,
  Trash2,
  Plus,
} from 'lucide-react';

export interface MapEditorPanelProps {
  isEditorActive: boolean;
  selectedObjectDef: MapObjectDefinition | null;
  transformMode: 'translate' | 'rotate' | 'scale';
  isSavingMap: boolean;
  availableModels: string[];
  selectedNewModel: string;
  mapFileName?: string;
  onToggleEditor: () => void;
  onSetGizmoMode: (mode: 'translate' | 'rotate' | 'scale') => void;
  onDeselect: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onAddNew: () => void;
  onSaveMap: () => void;
  onManualCoordChange: (axis: 'x' | 'y' | 'z', value: number) => void;
  onManualRotChange: (axis: 'x' | 'y' | 'z', value: number) => void;
  onSelectModelChange: (model: string) => void;
}

export const MapEditorPanel: React.FC<MapEditorPanelProps> = ({
  isEditorActive,
  selectedObjectDef,
  transformMode,
  isSavingMap,
  availableModels,
  selectedNewModel,
  mapFileName = 'pantano-map.json',
  onToggleEditor,
  onSetGizmoMode,
  onDeselect,
  onDuplicate,
  onDelete,
  onAddNew,
  onSaveMap,
  onManualCoordChange,
  onManualRotChange,
  onSelectModelChange,
}) => {
  if (!isEditorActive) return null;

  return (
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
            onClick={onToggleEditor}
            className="h-7 w-7 p-0 text-slate-400 hover:text-slate-100"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Accion de guardado permanente en disco */}
        <div className="space-y-2">
          <Button
            onClick={onSaveMap}
            disabled={isSavingMap}
            className="w-full justify-center gap-2 text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-medium"
          >
            <Save className="w-3.5 h-3.5" />
            {isSavingMap ? 'Guardando en disco...' : 'Guardar Mapa en Disco'}
          </Button>
          <p className="text-[10px] text-slate-500 text-center">
            Actualiza directamente <code>frontend/public/maps/{mapFileName}</code>
          </p>
        </div>

        {/* Agregar nuevo objeto al mapa */}
        <div className="space-y-2 pt-2 border-t border-slate-800">
          <Label className="text-xs text-slate-300">Instanciar Nuevo Objeto</Label>
          <div className="flex gap-2">
            <Select value={selectedNewModel} onValueChange={onSelectModelChange}>
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
              onClick={onAddNew}
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
                onClick={onDeselect}
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
                onClick={() => onSetGizmoMode('translate')}
                className="flex-1 h-7 text-[11px] gap-1"
              >
                <Move className="w-3 h-3" />
                Mover
              </Button>
              <Button
                variant={transformMode === 'rotate' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => onSetGizmoMode('rotate')}
                className="flex-1 h-7 text-[11px] gap-1"
              >
                <RotateCw className="w-3 h-3" />
                Rotar
              </Button>
              <Button
                variant={transformMode === 'scale' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => onSetGizmoMode('scale')}
                className="flex-1 h-7 text-[11px] gap-1"
              >
                <Maximize2 className="w-3 h-3" />
                Escalar
              </Button>
            </div>

            {/* Campos numericos de posicion exacta */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-medium text-slate-300">Posicion Mundial (X, Y, Z)</span>
              <div className="grid grid-cols-3 gap-1.5">
                <div>
                  <span className="text-[9px] text-slate-500 font-mono">X</span>
                  <Input
                    type="number"
                    step="0.5"
                    value={selectedObjectDef.position[0]}
                    onChange={(e) => onManualCoordChange('x', parseFloat(e.target.value) || 0)}
                    className="h-7 text-xs bg-slate-950 border-slate-700 px-1.5 font-mono"
                  />
                </div>
                <div>
                  <span className="text-[9px] text-slate-500 font-mono">Y (Alt)</span>
                  <Input
                    type="number"
                    step="0.5"
                    value={selectedObjectDef.position[1]}
                    onChange={(e) => onManualCoordChange('y', parseFloat(e.target.value) || 0)}
                    className="h-7 text-xs bg-slate-950 border-slate-700 px-1.5 font-mono"
                  />
                </div>
                <div>
                  <span className="text-[9px] text-slate-500 font-mono">Z</span>
                  <Input
                    type="number"
                    step="0.5"
                    value={selectedObjectDef.position[2]}
                    onChange={(e) => onManualCoordChange('z', parseFloat(e.target.value) || 0)}
                    className="h-7 text-xs bg-slate-950 border-slate-700 px-1.5 font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Campos numericos de rotacion exacta en radianes */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-medium text-slate-300">Rotacion (Rad)</span>
              <div className="grid grid-cols-3 gap-1.5">
                <div>
                  <span className="text-[9px] text-slate-500 font-mono">Rot X</span>
                  <Input
                    type="number"
                    step="0.1"
                    value={selectedObjectDef.rotation[0]}
                    onChange={(e) => onManualRotChange('x', parseFloat(e.target.value) || 0)}
                    className="h-7 text-xs bg-slate-950 border-slate-700 px-1.5 font-mono"
                  />
                </div>
                <div>
                  <span className="text-[9px] text-slate-500 font-mono">
                    Rot Y ({(((selectedObjectDef.rotation[1] * 180) / Math.PI + 360) % 360).toFixed(0)}°)
                  </span>
                  <Input
                    type="number"
                    step="0.05"
                    value={selectedObjectDef.rotation[1]}
                    onChange={(e) => onManualRotChange('y', parseFloat(e.target.value) || 0)}
                    className="h-7 text-xs bg-slate-950 border-slate-700 px-1.5 font-mono"
                  />
                </div>
                <div>
                  <span className="text-[9px] text-slate-500 font-mono">Rot Z</span>
                  <Input
                    type="number"
                    step="0.1"
                    value={selectedObjectDef.rotation[2]}
                    onChange={(e) => onManualRotChange('z', parseFloat(e.target.value) || 0)}
                    className="h-7 text-xs bg-slate-950 border-slate-700 px-1.5 font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Botones de duplicar y eliminar */}
            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={onDuplicate}
                className="flex-1 h-7 text-xs border-slate-700 text-slate-300 hover:bg-slate-800 gap-1"
              >
                <Copy className="w-3 h-3" />
                Duplicar
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={onDelete}
                className="flex-1 h-7 text-xs gap-1"
              >
                <Trash2 className="w-3 h-3" />
                Eliminar
              </Button>
            </div>
          </div>
        ) : (
          <div className="py-4 text-center border-t border-slate-800">
            <p className="text-xs text-slate-400">Haga clic sobre cualquier objeto 3D para seleccionarlo.</p>
            <p className="text-[10px] text-slate-500 mt-1">Presione Control para alternar a rotacion rapida.</p>
          </div>
        )}
      </Card>
    </div>
  );
};
