import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { UI_STRINGS } from '../data/anatomyData';
import { AnatomyPartData, Language, SpeciesData } from '../types/anatomy';

interface InspectorPanelProps {
  language: Language;
  species: SpeciesData;
  selectedPart: AnatomyPartData | null;
  onSelectPart: (partId: string | null) => void;
  onCloseMobile?: () => void;
}

export function InspectorPanel({
  language,
  species,
  selectedPart,
  onSelectPart,
  onCloseMobile,
}: InspectorPanelProps) {
  const t = UI_STRINGS[language];

  const currentIdx = selectedPart
    ? species.parts.findIndex((p) => p.id === selectedPart.id)
    : -1;

  const handleStep = (dir: -1 | 1) => {
    if (species.parts.length === 0) return;
    if (currentIdx === -1) {
      onSelectPart(species.parts[0].id);
      return;
    }
    const nextIdx = (currentIdx + dir + species.parts.length) % species.parts.length;
    onSelectPart(species.parts[nextIdx].id);
  };

  return (
    <aside className="h-full w-full flex flex-col bg-white border-l border-neutral-200">
      {/* Mobile Header */}
      {onCloseMobile && (
        <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-200 lg:hidden">
          <span className="text-sm font-semibold text-neutral-900">{t.anatomyInfo}</span>
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

      <div className="flex-1 overflow-y-auto atlas-scroll p-5 space-y-5">
        {/* Header & Title */}
        <div>
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <span className="text-xs font-semibold tracking-wide text-red-700">
              {t.anatomyInfo}
            </span>
            {selectedPart && (
              <span className="text-xs text-neutral-500">
                {selectedPart.layer === 'muscles'
                  ? t.musclesBadge
                  : selectedPart.layer === 'skeleton'
                    ? t.skeletonBadge
                    : selectedPart.layer === 'outer'
                      ? t.outerBadge
                      : t.internalBadge}
              </span>
            )}
          </div>

          <h2 className="text-xl font-semibold text-neutral-900 leading-snug">
            {selectedPart ? selectedPart.name[language] : species.name[language]}
          </h2>

          {selectedPart && (
            <p className="font-mono-tabular text-xs text-red-700 mt-0.5">
              {selectedPart.latinName}
            </p>
          )}

          {selectedPart && (
            <button
              type="button"
              onClick={() => onSelectPart(null)}
              className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-neutral-100 border border-neutral-200 text-xs font-medium text-neutral-700 hover:border-red-500 hover:text-red-700 transition-colors"
            >
              <span>← {t.exitFocusView}</span>
            </button>
          )}

          <p className="mt-3 text-sm leading-relaxed text-neutral-700">
            {selectedPart
              ? selectedPart.description[language]
              : species.description[language]}
          </p>
        </div>

        {/* Sub-structures & Detailed Nomenclature */}
        {selectedPart && selectedPart.subParts.length > 0 && (
          <div className="pt-4 border-t border-neutral-200">
            <h3 className="text-xs font-semibold tracking-wide text-red-700 mb-2">
              {t.subStructures}
            </h3>
            <ul className="space-y-1.5">
              {selectedPart.subParts.map((sub) => (
                <li
                  key={sub.id}
                  className="flex items-baseline justify-between gap-2 text-xs py-1.5 px-2.5 rounded-md bg-neutral-50 border border-neutral-200/80"
                >
                  <span className="text-neutral-900 font-medium">{sub.name[language]}</span>
                  <span className="font-mono-tabular text-[11px] text-red-700/85 shrink-0">
                    {sub.latin}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Function / Working / Fact */}
        {selectedPart ? (
          <div className="space-y-4 pt-4 border-t border-neutral-200">
            <div>
              <h3 className="text-xs font-semibold tracking-wide text-red-700 mb-1.5">
                {t.primaryFunction}
              </h3>
              <p className="text-sm leading-relaxed text-neutral-700">
                {selectedPart.func[language]}
              </p>
            </div>

            <div>
              <h3 className="text-xs font-semibold tracking-wide text-red-700 mb-1.5">
                {t.howItWorks}
              </h3>
              <p className="text-sm leading-relaxed text-neutral-700">
                {selectedPart.working[language]}
              </p>
            </div>

            <div>
              <h3 className="text-xs font-semibold tracking-wide text-red-700 mb-1.5">
                {t.interestingFact}
              </h3>
              <p className="text-sm leading-relaxed text-neutral-700">
                {selectedPart.fact[language]}
              </p>
            </div>
          </div>
        ) : (
          <div className="pt-4 border-t border-neutral-200">
            <p className="text-sm leading-relaxed text-neutral-500">
              {t.selectPromptHint}
            </p>
          </div>
        )}

        {/* Region & Classification */}
        <div className="pt-4 border-t border-neutral-200 space-y-3">
          <div>
            <h3 className="text-xs font-semibold tracking-wide text-red-700 mb-1">
              {t.regionLabel}
            </h3>
            <p className="text-xs leading-relaxed text-neutral-700">
              {species.region[language]}
            </p>
          </div>
          <div>
            <h3 className="text-xs font-semibold tracking-wide text-red-700 mb-1">
              {t.classification}
            </h3>
            <p className="font-mono-tabular text-xs leading-relaxed text-neutral-600">
              {species.classification}
            </p>
          </div>
        </div>
      </div>

      {/* Footer Prev / Next Organ Stepper */}
      <div className="shrink-0 p-3 border-t border-neutral-200 bg-neutral-50 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => handleStep(-1)}
          className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-white border border-neutral-200 text-xs font-medium text-neutral-800 hover:border-red-500 hover:text-red-700 transition-colors whitespace-nowrap"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          <span>{t.prevPart}</span>
        </button>

        <span className="font-mono-tabular text-xs text-neutral-500 px-2">
          {currentIdx >= 0 ? `${currentIdx + 1}/${species.parts.length}` : `0/${species.parts.length}`}
        </span>

        <button
          type="button"
          onClick={() => handleStep(1)}
          className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-white border border-neutral-200 text-xs font-medium text-neutral-800 hover:border-red-500 hover:text-red-700 transition-colors whitespace-nowrap"
        >
          <span>{t.nextPart}</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </aside>
  );
}
