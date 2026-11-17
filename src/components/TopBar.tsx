import { Globe, Info, Layers, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { UI_STRINGS } from '../data/anatomyData';
import { Language, SpeciesData } from '../types/anatomy';

interface TopBarProps {
  language: Language;
  species: SpeciesData;
  zenMode: boolean;
  onToggleLanguage: (lang: Language) => void;
  onToggleZenMode: () => void;
  onOpenMobileExplorer: () => void;
  onOpenMobileInspector: () => void;
}

export function TopBar({
  language,
  species,
  zenMode,
  onToggleLanguage,
  onToggleZenMode,
  onOpenMobileExplorer,
  onOpenMobileInspector,
}: TopBarProps) {
  const t = UI_STRINGS[language];

  return (
    <header className="h-14 shrink-0 bg-white border-b border-neutral-200 px-4 lg:px-5 flex items-center justify-between gap-4 z-30">
      {/* Zone 1: Single-line Brand Wordmark */}
      <div className="flex items-center gap-2.5 min-w-0">
        <span className="w-2 h-5 rounded-xs bg-red-600 shrink-0" aria-hidden="true" />
        <span className="text-base lg:text-lg font-semibold tracking-tight text-neutral-900 whitespace-nowrap shrink-0">
          {t.brandTitle}
        </span>
      </div>

      {/* Zone 2: Clean unboxed specimen metadata */}
      <div className="hidden md:flex items-center gap-2 text-xs text-neutral-500 truncate">
        <span className="text-red-700 font-semibold whitespace-nowrap">
          {species.name[language]}
        </span>
        <span aria-hidden="true">·</span>
        <span className="whitespace-nowrap">{species.category[language]}</span>
        <span aria-hidden="true">·</span>
        <span className="whitespace-nowrap text-neutral-600">{species.region[language]}</span>
        <span aria-hidden="true" className="hidden xl:inline">·</span>
        <span className="hidden xl:inline font-mono-tabular text-neutral-500 truncate">
          {species.classification}
        </span>
      </div>

      {/* Zone 3: Language Switch & Panel Controls */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Mobile drawer buttons */}
        <button
          type="button"
          onClick={onOpenMobileExplorer}
          className="lg:hidden inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-neutral-200 bg-neutral-50 text-xs font-medium text-neutral-800 hover:border-red-500 hover:text-red-700 transition-colors whitespace-nowrap shrink-0"
        >
          <Layers className="w-3.5 h-3.5 text-red-600" />
          <span>{t.organismsDrawer}</span>
        </button>

        <button
          type="button"
          onClick={onOpenMobileInspector}
          className="lg:hidden inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-neutral-200 bg-neutral-50 text-xs font-medium text-neutral-800 hover:border-red-500 hover:text-red-700 transition-colors whitespace-nowrap shrink-0"
        >
          <Info className="w-3.5 h-3.5 text-red-600" />
          <span>{t.infoDrawer}</span>
        </button>

        {/* Desktop Zen Mode toggle */}
        <button
          type="button"
          onClick={onToggleZenMode}
          className="hidden lg:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-200 bg-neutral-50 text-xs font-medium text-neutral-700 hover:border-red-500/70 hover:text-red-700 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-red-600"
        >
          {zenMode ? (
            <PanelLeftOpen className="w-3.5 h-3.5 text-red-600" />
          ) : (
            <PanelLeftClose className="w-3.5 h-3.5 text-red-600" />
          )}
          <span>{zenMode ? t.showPanels : t.zenMode}</span>
        </button>

        {/* Language Segmented Control */}
        <div
          role="group"
          aria-label="Language switch"
          className="inline-flex items-center p-0.5 rounded-lg bg-neutral-100 border border-neutral-200"
        >
          <Globe className="w-3.5 h-3.5 text-neutral-500 mx-1.5 hidden sm:block shrink-0" />
          <button
            type="button"
            onClick={() => onToggleLanguage('mn')}
            className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
              language === 'mn'
                ? 'bg-red-600 text-white shadow-xs'
                : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            MN
          </button>
          <button
            type="button"
            onClick={() => onToggleLanguage('en')}
            className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
              language === 'en'
                ? 'bg-red-600 text-white shadow-xs'
                : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            EN
          </button>
        </div>
      </div>
    </header>
  );
}
