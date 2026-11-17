export type Language = 'mn' | 'en';

export type SpeciesId = 'human' | 'human_female';

export type PartLayer = 'outer' | 'muscles' | 'skeleton' | 'internal';

export type LayerFilter = 'all' | 'outer' | 'muscles' | 'skeleton' | 'internal';

export type RenderMode = 'realistic' | 'scientific';

export type LabelMode = 'off' | 'organs' | 'detailed';

export interface LocalizedText {
  mn: string;
  en: string;
}

export type Vec3Tuple = [number, number, number];

export interface SubPartLabel {
  id: string;
  anchorLocal: Vec3Tuple;
  name: LocalizedText;
  latin: string;
}

export interface AnatomyPartData {
  id: string;
  layer: PartLayer;
  color: number;
  hexColor: string;
  basePosition: Vec3Tuple;
  explodeOffset: Vec3Tuple;
  labelOffset: Vec3Tuple;
  latinName: string;
  name: LocalizedText;
  description: LocalizedText;
  func: LocalizedText;
  working: LocalizedText;
  fact: LocalizedText;
  subParts: SubPartLabel[];
}

export interface SpeciesData {
  id: SpeciesId;
  name: LocalizedText;
  category: LocalizedText;
  region: LocalizedText;
  description: LocalizedText;
  classification: string;
  cameraPosition: Vec3Tuple;
  cameraTarget: Vec3Tuple;
  groundY: number;
  parts: AnatomyPartData[];
}
