import { Search, X } from 'lucide-react';
import { UI_STRINGS } from '../data/anatomyData';
import {
  Language,
  LayerFilter,
  SpeciesData,
  SpeciesId,
} from '../types/anatomy';

interface ExplorerSidebarProps {
  language: Language;
  activeSpeciesId: SpeciesId;
  activeSpecies: SpeciesData;
  searchQuery: string;
  layerFilter: LayerFilter;
  selectedPartId: string | null;
  onSelectHumanSex: (sex: 'male' | 'female') => void;
  onSearchChange: (q: string) => void;
  onChangeLayer: (layer: LayerFilter) => void;
  onSelectPart: (partId: string) => void;
  onCloseMobile?: () => void;
}

export function ExplorerSidebar({
  language,
  activeSpeciesId,
  activeSpecies,
  searchQuery,
  layerFilter,
  selectedPartId,
  onSelectHumanSex,
  onSearchChange,
  onChangeLayer,
  onSelectPart,
  onCloseMobile,
}: ExplorerSidebarProps) {
  const t = UI_STRINGS[language];
  const normalizedQuery = searchQuery.trim().toLowerCase();

  const visibleParts = activeSpecies.parts.filter((part) => {
    if (layerFilter !== 'all' && part.layer !== layerFilter) return false;
    if (!normalizedQuery) return true;
    return (
      part.name.mn.toLowerCase().includes(normalizedQuery) ||
      part.name.en.toLowerCase().includes(normalizedQuery) ||
      part.latinName.toLowerCase().includes(normalizedQuery) ||
      part.subParts.some(
        (sub) =>
          sub.name.mn.toLowerCase().includes(normalizedQuery) ||
          sub.name.en.toLowerCase().includes(normalizedQuery) ||
          sub.latin.toLowerCase().includes(normalizedQuery)
      )
    );
  });

  const layerOptions: LayerFilter[] = ['all', 'outer', 'muscles', 'skeleton', 'internal'];

  return (
    <aside className="h-full w-full flex flex-col bg-white border-r border-neutral-200 select-none">
      {/* Mobile Header */}
      {onCloseMobile && (
        <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-200 lg:hidden">
          <span className="text-sm font-semibold text-neutral-900">{t.selectOrganism}</span>
          <button
            type="button"
            onClick={onCloseMobile}
            aria-label="Close"
            className="p-1.5 rounded-lg text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto atlas-scroll p-4 space-y-5">
        {/* Biological Sex Switch (Human Male / Female) */}
        <section>
          <h2 className="text-xs font-semibold tracking-wide text-red-700 mb-2">
            {t.biologicalSex}
          </h2>
          <div className="grid grid-cols-2 gap-1 p-1 rounded-lg bg-neutral-100 border border-neutral-200">
            <button
              type="button"
              onClick={() => onSelectHumanSex('male')}
              className={`py-1.5 px-2 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                activeSpeciesId === 'human'
                  ? 'bg-red-600 text-white shadow-xs'
                  : 'text-neutral-700 hover:text-neutral-950'
              }`}
            >
              {t.sexMale}
            </button>
            <button
              type="button"
              onClick={() => onSelectHumanSex('female')}
              className={`py-1.5 px-2 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                activeSpeciesId === 'human_female'
                  ? 'bg-red-600 text-white shadow-xs'
                  : 'text-neutral-700 hover:text-neutral-950'
              }`}
            >
              {t.sexFemale}
            </button>
          </div>
        </section>

        {/* Layer Filter */}
        <section className="pt-4 border-t border-neutral-200">
          <h2 className="text-xs font-semibold tracking-wide text-red-700 mb-2.5">
            {t.structuralLayer}
          </h2>
          <div className="grid grid-cols-2 gap-1 p-1 rounded-lg bg-neutral-100 border border-neutral-200">
            {layerOptions.map((layer) => {
              const label =
                layer === 'all'
                  ? t.layerAll
                  : layer === 'outer'
                    ? t.layerOuter
                    : layer === 'muscles'
                      ? t.layerMuscles
                      : layer === 'skeleton'
                        ? t.layerSkeleton
                        : t.layerInternal;
              const active = layerFilter === layer;
              return (
                <button
                  key={layer}
                  type="button"
                  onClick={() => onChangeLayer(layer)}
                  className={`py-1.5 px-2 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                    active
                      ? 'bg-red-600 text-white shadow-xs'
                      : 'text-neutral-700 hover:text-neutral-950'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </section>

        {/* Human Structure Search & List */}
        <section className="pt-4 border-t border-neutral-200">
          <div className="flex items-center justify-between mb-2.5">
            <h2 className="text-xs font-semibold tracking-wide text-red-700">
              {t.selectedStructure}
            </h2>
            <span className="font-mono-tabular text-[11px] text-neutral-500">
              {visibleParts.length}/{activeSpecies.parts.length}
            </span>
          </div>

          <div className="relative mb-3">
            <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={t.searchPlaceholder}
              className="w-full pl-8 pr-8 py-2 rounded-lg bg-neutral-50 border border-neutral-200 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:border-red-600 focus:bg-white"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => onSearchChange('')}
                aria-label="Clear search"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="space-y-1">
            {visibleParts.length === 0 ? (
              <p className="text-xs text-neutral-500 py-3 px-2">{t.noSpeciesFound}</p>
            ) : (
              visibleParts.map((part) => {
                const isSelected = part.id === selectedPartId;
                return (
                  <button
                    key={part.id}
                    type="button"
                    onClick={() => {
                      onSelectPart(part.id);
                      onCloseMobile?.();
                    }}
                    className={`w-full flex items-start gap-2.5 px-3 py-2 rounded-lg text-left text-sm transition-colors ${
                      isSelected
                        ? 'bg-red-50 text-red-950 border border-red-500/70 font-medium'
                        : 'text-neutral-700 border border-transparent hover:bg-neutral-100 hover:text-neutral-900'
                    }`}
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0 border border-black/15 mt-1"
                      style={{ backgroundColor: part.hexColor }}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate leading-snug">{part.name[language]}</span>
                      <span
                        className={`block truncate font-mono-tabular text-[10.5px] ${
                          isSelected ? 'text-red-700/85' : 'text-neutral-500'
                        }`}
                      >
                        {part.latinName}
                      </span>
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </section>
      </div>
    </aside>
  );
}
