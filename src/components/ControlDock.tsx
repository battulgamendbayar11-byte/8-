import {
  Activity,
  Box,
  ChevronDown,
  ChevronUp,
  Home,
  Minus,
  Plus,
  RotateCcw,
  RotateCw,
  Tag,
} from 'lucide-react';
import { UI_STRINGS } from '../data/anatomyData';
import { LabelMode, Language, RenderMode } from '../types/anatomy';

interface ControlDockProps {
  language: Language;
  explodeFactor: number;
  renderMode: RenderMode;
  labelMode: LabelMode;
  autoRotate: boolean;
  live4D: boolean;
  collapsed: boolean;
  onChangeExplode: (val: number) => void;
  onToggleRenderMode: () => void;
  onCycleLabelMode: () => void;
  onToggleAutoRotate: () => void;
  onToggleLive4D: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetCamera: () => void;
  onResetHome: () => void;
  onToggleCollapsed: () => void;
}

export function ControlDock({
  language,
  explodeFactor,
  renderMode,
  labelMode,
  autoRotate,
  live4D,
  collapsed,
  onChangeExplode,
  onToggleRenderMode,
  onCycleLabelMode,
  onToggleAutoRotate,
  onToggleLive4D,
  onZoomIn,
  onZoomOut,
  onResetCamera,
  onResetHome,
  onToggleCollapsed,
}: ControlDockProps) {
  const t = UI_STRINGS[language];
  const isSci = renderMode === 'scientific';
  const labelText =
    labelMode === 'detailed'
      ? t.labelModeDetailed
      : labelMode === 'organs'
        ? t.labelModeOrgans
        : t.labelModeOff;

  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center max-w-[94vw]">
      {/* Collapse / Expand Handle */}
      <button
        type="button"
        onClick={onToggleCollapsed}
        className="mb-1.5 inline-flex items-center gap-1.5 px-3 py-1 rounded-t-lg rounded-b-md bg-white border border-neutral-200 shadow-sm text-[11px] font-medium text-neutral-700 hover:text-red-700 hover:border-red-400 transition-colors whitespace-nowrap"
      >
        {collapsed ? (
          <>
            <ChevronUp className="w-3.5 h-3.5 text-red-600" />
            <span>{t.expandDock}</span>
          </>
        ) : (
          <>
            <ChevronDown className="w-3.5 h-3.5 text-red-600" />
            <span>{t.collapseDock}</span>
          </>
        )}
      </button>

      {/* Main Dock Bar (solid/high-opacity surface without backdrop-blur over WebGL) */}
      <div
        className={`transition-all duration-200 origin-bottom ${
          collapsed
            ? 'opacity-0 scale-95 translate-y-4 pointer-events-none h-0 overflow-hidden'
            : 'opacity-100 scale-100 translate-y-0'
        }`}
      >
        <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 px-3.5 py-2.5 rounded-xl bg-white/95 border border-neutral-200 shadow-lg shadow-neutral-900/8">
          {/* Exploded View Slider */}
          <div className="flex items-center gap-2.5 pr-2 sm:border-r sm:border-neutral-200">
            <label
              htmlFor="explode-slider"
              className="text-xs font-medium text-neutral-700 whitespace-nowrap"
            >
              {t.explodeLabel}
            </label>
            <input
              id="explode-slider"
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={explodeFactor}
              onChange={(e) => onChangeExplode(parseFloat(e.target.value))}
              className="atlas-range w-24 sm:w-28"
            />
            <span className="font-mono-tabular text-xs font-medium text-red-700 w-9 text-right">
              {Math.round(explodeFactor * 100)}%
            </span>
          </div>

          {/* Mode & Toggles */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onToggleLive4D}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap ${
                live4D
                  ? 'bg-red-50 text-red-700 border-red-500/60'
                  : 'bg-neutral-50 text-neutral-700 border-neutral-200 hover:border-red-400 hover:text-red-700'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>{t.live4DLabel}</span>
            </button>

            <button
              type="button"
              onClick={onToggleRenderMode}
              title={isSci ? t.scientificMode : t.realisticMode}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap ${
                isSci
                  ? 'bg-red-600 text-white border-red-600 shadow-xs'
                  : 'bg-neutral-50 text-neutral-700 border-neutral-200 hover:border-red-400 hover:text-red-700'
              }`}
            >
              <Box className="w-3.5 h-3.5" />
              <span>{t.wireToggle}</span>
            </button>

            <button
              type="button"
              onClick={onCycleLabelMode}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap ${
                labelMode !== 'off'
                  ? 'bg-red-50 text-red-700 border-red-500/60'
                  : 'bg-neutral-50 text-neutral-700 border-neutral-200 hover:border-red-400 hover:text-red-700'
              }`}
            >
              <Tag className="w-3.5 h-3.5" />
              <span>{labelText}</span>
            </button>

            <button
              type="button"
              onClick={onToggleAutoRotate}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap ${
                autoRotate
                  ? 'bg-red-50 text-red-700 border-red-500/60'
                  : 'bg-neutral-50 text-neutral-700 border-neutral-200 hover:border-red-400 hover:text-red-700'
              }`}
            >
              <RotateCw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t.rotateToggle}</span>
            </button>
          </div>

          {/* Camera Actions */}
          <div className="flex items-center gap-1 pl-1 sm:border-l sm:border-neutral-200">
            <button
              type="button"
              onClick={onZoomIn}
              title={t.zoomIn}
              aria-label={t.zoomIn}
              className="p-1.5 rounded-lg bg-neutral-50 border border-neutral-200 text-neutral-700 hover:border-red-400 hover:text-red-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onZoomOut}
              title={t.zoomOut}
              aria-label={t.zoomOut}
              className="p-1.5 rounded-lg bg-neutral-50 border border-neutral-200 text-neutral-700 hover:border-red-400 hover:text-red-700 transition-colors"
            >
              <Minus className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onResetCamera}
              title={t.resetView}
              aria-label={t.resetView}
              className="p-1.5 rounded-lg bg-neutral-50 border border-neutral-200 text-neutral-700 hover:border-red-400 hover:text-red-700 transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onResetHome}
              title={t.homeSpecies}
              aria-label={t.homeSpecies}
              className="p-1.5 rounded-lg bg-neutral-50 border border-neutral-200 text-neutral-700 hover:border-red-400 hover:text-red-700 transition-colors"
            >
              <Home className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
