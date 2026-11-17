import { Language, SpeciesData, SpeciesId } from '../types/anatomy';
import { SPECIES_PART_1 } from './speciesPart1';

export const SPECIES_ORDER: SpeciesId[] = ['human', 'human_female'];

export const SPECIES_DATA: Record<SpeciesId, SpeciesData> = {
  ...SPECIES_PART_1,
};

export interface UiStrings {
  brandTitle: string;
  selectOrganism: string;
  searchPlaceholder: string;
  noSpeciesFound: string;
  biologicalSex: string;
  sexMale: string;
  sexFemale: string;
  visualization: string;
  realisticMode: string;
  scientificMode: string;
  structuralLayer: string;
  layerAll: string;
  layerOuter: string;
  layerMuscles: string;
  layerSkeleton: string;
  layerInternal: string;
  selectedStructure: string;
  anatomyInfo: string;
  primaryFunction: string;
  howItWorks: string;
  interestingFact: string;
  subStructures: string;
  classification: string;
  regionLabel: string;
  selectPromptHint: string;
  explodeLabel: string;
  live4DLabel: string;
  labelsToggle: string;
  labelModeOff: string;
  labelModeOrgans: string;
  labelModeDetailed: string;
  rotateToggle: string;
  wireToggle: string;
  zoomIn: string;
  zoomOut: string;
  resetView: string;
  homeSpecies: string;
  collapseDock: string;
  expandDock: string;
  controlsHint: string;
  loading3d: string;
  prevPart: string;
  nextPart: string;
  outerBadge: string;
  musclesBadge: string;
  skeletonBadge: string;
  internalBadge: string;
  zenMode: string;
  showPanels: string;
  organismsDrawer: string;
  infoDrawer: string;
  webglLostTitle: string;
  webglLostDesc: string;
  exitFocusView: string;
  focusedOrganHint: string;
}

export const UI_STRINGS: Record<Language, UiStrings> = {
  mn: {
    brandTitle: 'Human Anatomy 3D',
    selectOrganism: 'Хүний анатомийн загвар',
    searchPlaceholder: 'Бүтэц хайх...',
    noSpeciesFound: 'Тохирох бүтэц олдсонгүй.',
    biologicalSex: 'Биологийн хүйс',
    sexMale: 'Эрэгтэй',
    sexFemale: 'Эмэгтэй',
    visualization: 'Дүрслэл',
    realisticMode: 'Realistic 3D',
    scientificMode: 'Scientific 3D',
    structuralLayer: 'Бүтцийн давхарга',
    layerAll: 'Бүгд',
    layerOuter: 'Гадна',
    layerMuscles: 'Булчин',
    layerSkeleton: 'Араг яс',
    layerInternal: 'Дотор',
    selectedStructure: 'Сонгосон бүтэц',
    anatomyInfo: 'Анатомийн мэдээлэл',
    primaryFunction: 'Үндсэн үүрэг',
    howItWorks: 'Хэрхэн ажилладаг вэ?',
    interestingFact: 'Сонирхолтой баримт',
    subStructures: 'Нарийвчилсан бүтэц ба нэршил',
    classification: 'Ангилал',
    regionLabel: 'Тархац',
    selectPromptHint: 'Булчин, шөрмөс, холбоос, араг яс, үе мөч болон дотор эрхтнийг томруулан нарийвчлан харахын тулд 3D бүтэц эсвэл жагсаалтаас сонгоно уу.',
    explodeLabel: 'Задлах',
    live4DLabel: '4D Хөдөлгөөн',
    labelsToggle: 'Шошго',
    labelModeOff: 'Шошго: Хаалттай',
    labelModeOrgans: 'Шошго: Энгийн',
    labelModeDetailed: 'Шошго: Нарийвчилсан',
    rotateToggle: 'Эргүүлэх',
    wireToggle: 'Scientific',
    zoomIn: 'Ойртуулах',
    zoomOut: 'Холдуулах',
    resetView: 'Камер сэргээх',
    homeSpecies: 'Анхны төлөв',
    collapseDock: 'Удирдлага нуух (H)',
    expandDock: 'Удирдлага нээх (H)',
    controlsHint: 'Чирэх: Эргүүлэх · Дугуй: Томруулах · Дарах: Эрхтэн томруулах',
    loading3d: '4D загвар ачаалж байна...',
    prevPart: 'Өмнөх',
    nextPart: 'Дараах',
    outerBadge: 'Гадна бүтэц',
    musclesBadge: 'Булчин ба шөрмөсний тогтолцоо',
    skeletonBadge: 'Араг яс ба холбоос',
    internalBadge: 'Дотор ба мэдрэхүйн эрхтэн',
    zenMode: 'Бүтэн дэлгэц',
    showPanels: 'Самбар нээх',
    organismsDrawer: 'Анатоми',
    infoDrawer: 'Мэдээлэл',
    webglLostTitle: '3D дүрслэл түр саатлаа',
    webglLostDesc: 'WebGL контекст сэргэхийг хүлээж байна эсвэл хуудсыг дахин ачаална уу.',
    exitFocusView: 'Бүтэн бие рүү буцах',
    focusedOrganHint: 'Нарийвчилсан горим',
  },
  en: {
    brandTitle: 'Human Anatomy 3D',
    selectOrganism: 'Human Anatomy Model',
    searchPlaceholder: 'Search structures...',
    noSpeciesFound: 'No matching structure found.',
    biologicalSex: 'Biological Sex',
    sexMale: 'Male',
    sexFemale: 'Female',
    visualization: 'Render Mode',
    realisticMode: 'Realistic 3D',
    scientificMode: 'Scientific 3D',
    structuralLayer: 'Structural Layer',
    layerAll: 'All',
    layerOuter: 'Outer',
    layerMuscles: 'Muscles',
    layerSkeleton: 'Skeleton',
    layerInternal: 'Organs',
    selectedStructure: 'Selected Structure',
    anatomyInfo: 'Anatomy Information',
    primaryFunction: 'Primary Function',
    howItWorks: 'How It Works',
    interestingFact: 'Biological Fact',
    subStructures: 'Detailed Sub-structures',
    classification: 'Classification',
    regionLabel: 'Native Region',
    selectPromptHint: 'Click any muscle, tendon, joint, bone, eye, or organ to enlarge and inspect it in high detail against the full model.',
    explodeLabel: 'Explode',
    live4DLabel: '4D Motion',
    labelsToggle: 'Labels',
    labelModeOff: 'Labels: Off',
    labelModeOrgans: 'Labels: Basic',
    labelModeDetailed: 'Labels: Detailed',
    rotateToggle: 'Rotate',
    wireToggle: 'Scientific',
    zoomIn: 'Zoom In',
    zoomOut: 'Zoom Out',
    resetView: 'Reset Camera',
    homeSpecies: 'Reset Model',
    collapseDock: 'Hide Controls (H)',
    expandDock: 'Show Controls (H)',
    controlsHint: 'Drag: Orbit · Scroll: Zoom · Click: Focus Organ',
    loading3d: 'Building 4D anatomy...',
    prevPart: 'Previous',
    nextPart: 'Next',
    outerBadge: 'Outer Layer',
    musclesBadge: 'Muscular & Tendon System',
    skeletonBadge: 'Skeletal & Ligament System',
    internalBadge: 'Internal & Sensory Organ',
    zenMode: 'Zen View',
    showPanels: 'Show Panels',
    organismsDrawer: 'Anatomy',
    infoDrawer: 'Details',
    webglLostTitle: '3D Viewport Interrupted',
    webglLostDesc: 'Waiting for WebGL context recovery, or reload to restore rendering.',
    exitFocusView: 'Back to Full Body',
    focusedOrganHint: 'High-Detail Focus',
  },
};
