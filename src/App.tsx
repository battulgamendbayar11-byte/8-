import { useEffect, useMemo, useRef, useState } from 'react';
import { AnatomyViewport, AnatomyViewportHandle } from './components/AnatomyViewport';
import { ControlDock } from './components/ControlDock';
import { ExplorerSidebar } from './components/ExplorerSidebar';
import { InspectorPanel } from './components/InspectorPanel';
import { TopBar } from './components/TopBar';
import { SPECIES_DATA } from './data/anatomyData';
import { LabelMode, Language, LayerFilter, RenderMode, SpeciesId } from './types/anatomy';

export default function App() {
  const [language, setLanguage] = useState<Language>('mn');
  const [activeSpeciesId, setActiveSpeciesId] = useState<SpeciesId>('human');
  const [selectedPartId, setSelectedPartId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [layerFilter, setLayerFilter] = useState<LayerFilter>('all');
  const [renderMode, setRenderMode] = useState<RenderMode>('realistic');
  const [explodeFactor, setExplodeFactor] = useState(0);
  const [labelMode, setLabelMode] = useState<LabelMode>('detailed');
  const [autoRotate, setAutoRotate] = useState(true);
  const [live4D, setLive4D] = useState(true);
  const [dockCollapsed, setDockCollapsed] = useState(false);
  const [zenMode, setZenMode] = useState(false);

  const [mobileExplorerOpen, setMobileExplorerOpen] = useState(false);
  const [mobileInspectorOpen, setMobileInspectorOpen] = useState(false);

  const viewportRef = useRef<AnatomyViewportHandle | null>(null);

  const activeSpecies = SPECIES_DATA[activeSpeciesId];

  const selectedPart = useMemo(() => {
    if (!selectedPartId) return null;
    return activeSpecies.parts.find((p) => p.id === selectedPartId) ?? null;
  }, [activeSpecies, selectedPartId]);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  // Keyboard shortcut 'H' to toggle bottom control dock
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        return;
      }
      if (e.key === 'h' || e.key === 'H') {
        setDockCollapsed((prev) => !prev);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const handleChangeLayer = (layer: LayerFilter) => {
    setLayerFilter(layer);
    if (selectedPart && layer !== 'all' && selectedPart.layer !== layer) {
      setSelectedPartId(null);
    }
  };

  const handleSelectHumanSex = (sex: 'male' | 'female') => {
    const targetId: SpeciesId = sex === 'female' ? 'human_female' : 'human';
    if (targetId === activeSpeciesId) return;
    setActiveSpeciesId(targetId);
    setSelectedPartId(null);
  };

  const handleResetHome = () => {
    setSelectedPartId(null);
    setLayerFilter('all');
    setRenderMode('realistic');
    setExplodeFactor(0);
    setLive4D(true);
    viewportRef.current?.resetCamera();
  };

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-[#f8f9fa] text-neutral-900">
      <TopBar
        language={language}
        species={activeSpecies}
        zenMode={zenMode}
        onToggleLanguage={setLanguage}
        onToggleZenMode={() => setZenMode((prev) => !prev)}
        onOpenMobileExplorer={() => {
          setMobileInspectorOpen(false);
          setMobileExplorerOpen(true);
        }}
        onOpenMobileInspector={() => {
          setMobileExplorerOpen(false);
          setMobileInspectorOpen(true);
        }}
      />

      <div className="relative flex-1 min-h-0 flex overflow-hidden">
        {/* Desktop Left Sidebar */}
        {!zenMode && (
          <div className="hidden lg:block w-[264px] shrink-0 h-full">
            <ExplorerSidebar
              language={language}
              activeSpeciesId={activeSpeciesId}
              activeSpecies={activeSpecies}
              searchQuery={searchQuery}
              layerFilter={layerFilter}
              selectedPartId={selectedPartId}
              onSelectHumanSex={handleSelectHumanSex}
              onSearchChange={setSearchQuery}
              onChangeLayer={handleChangeLayer}
              onSelectPart={setSelectedPartId}
            />
          </div>
        )}

        {/* Central Unobstructed 3D Viewport */}
        <main className="relative flex-1 min-w-0 h-full">
          <AnatomyViewport
            ref={viewportRef}
            species={activeSpecies}
            language={language}
            layerFilter={layerFilter}
            renderMode={renderMode}
            explodeFactor={explodeFactor}
            selectedPartId={selectedPartId}
            autoRotate={autoRotate}
            labelMode={labelMode}
            live4D={live4D}
            onSelectPart={setSelectedPartId}
          />

          <ControlDock
            language={language}
            explodeFactor={explodeFactor}
            renderMode={renderMode}
            labelMode={labelMode}
            autoRotate={autoRotate}
            live4D={live4D}
            collapsed={dockCollapsed}
            onChangeExplode={setExplodeFactor}
            onToggleRenderMode={() =>
              setRenderMode((prev) => (prev === 'realistic' ? 'scientific' : 'realistic'))
            }
            onCycleLabelMode={() =>
              setLabelMode((prev) =>
                prev === 'detailed' ? 'organs' : prev === 'organs' ? 'off' : 'detailed'
              )
            }
            onToggleAutoRotate={() => setAutoRotate((prev) => !prev)}
            onToggleLive4D={() => setLive4D((prev) => !prev)}
            onZoomIn={() => viewportRef.current?.zoomIn()}
            onZoomOut={() => viewportRef.current?.zoomOut()}
            onResetCamera={() => viewportRef.current?.resetCamera()}
            onResetHome={handleResetHome}
            onToggleCollapsed={() => setDockCollapsed((prev) => !prev)}
          />
        </main>

        {/* Desktop Right Inspector */}
        {!zenMode && (
          <div className="hidden lg:block w-[316px] shrink-0 h-full">
            <InspectorPanel
              language={language}
              species={activeSpecies}
              selectedPart={selectedPart}
              onSelectPart={setSelectedPartId}
            />
          </div>
        )}

        {/* Mobile Left Explorer Drawer */}
        {mobileExplorerOpen && (
          <div className="fixed inset-0 z-40 lg:hidden flex">
            <div
              className="fixed inset-0 bg-black/60"
              onClick={() => setMobileExplorerOpen(false)}
            />
            <div className="relative z-10 w-[280px] max-w-[85vw] h-full shadow-2xl">
              <ExplorerSidebar
                language={language}
                activeSpeciesId={activeSpeciesId}
                activeSpecies={activeSpecies}
                searchQuery={searchQuery}
                layerFilter={layerFilter}
                selectedPartId={selectedPartId}
                onSelectHumanSex={handleSelectHumanSex}
                onSearchChange={setSearchQuery}
                onChangeLayer={handleChangeLayer}
                onSelectPart={setSelectedPartId}
                onCloseMobile={() => setMobileExplorerOpen(false)}
              />
            </div>
          </div>
        )}

        {/* Mobile Right Inspector Drawer */}
        {mobileInspectorOpen && (
          <div className="fixed inset-0 z-40 lg:hidden flex justify-end">
            <div
              className="fixed inset-0 bg-black/60"
              onClick={() => setMobileInspectorOpen(false)}
            />
            <div className="relative z-10 w-[310px] max-w-[88vw] h-full shadow-2xl">
              <InspectorPanel
                language={language}
                species={activeSpecies}
                selectedPart={selectedPart}
                onSelectPart={setSelectedPartId}
                onCloseMobile={() => setMobileInspectorOpen(false)}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
