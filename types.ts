
export interface StructuralFeature {
  type: 'Stairs' | 'Door' | 'Window' | 'Fireplace' | 'Deck' | 'Opening' | 'Niche';
  location: string;
  details: string;
}

export interface Room {
  id: string;
  name: string;
  level: number;
  dimensions: string;
  sqFt: number;
  features: string[];
  structuralFeatures: StructuralFeature[];
  adjacencies: string[];
}

export interface BuildingMap {
  totalLevels: number;
  globalFootprint: string;
  exteriorFeatures: string[];
  rooms: Room[];
}

export interface MaterialItem {
  id: string;
  room: string;
  category: 'Finishes' | 'Furnishings' | 'Structural' | 'Electrical' | 'Plumbing';
  type: string;
  quantity: string;
  unit: string;
  notes: string;
}

export type RenderType = 'exterior_iso' | 'exterior_elev' | 'interior_plan' | 'interior_persp';

export interface RenderRequest {
  type: RenderType;
  viewpoint: string; // e.g., 'SE', 'North', 'Living Room 200'
  targetRoomId?: string;
}

export interface ValidationStep {
  category: string;
  score: number;
  evidence: string;
  status: 'PASS' | 'FAIL' | 'WARN';
}

export interface RenderResult {
  id: string;
  imageUrl: string;
  selfScoreText: string;
  auditText?: string;
  isValidated: boolean;
  status: 'VERIFIED' | 'VIOLATION' | 'PENDING';
  request: RenderRequest;
  timestamp: number;
}

export interface LibraryItem {
  id: string;
  title: string;
  content: string;
  category: 'A' | 'B'; // A: Core Constitution (System), B: Workflows (User)
  isActive: boolean;
}
