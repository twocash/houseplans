
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
  viewpoint: string; 
  targetRoomId?: string;
}

export interface AuditFailure {
  category: 'ROOF' | 'STAIRCASE' | 'SOUTH_WALL' | 'EAST_WALL' | 'WEST_WALL' | 'NORTH_WALL' | 'DECK' | 'FOOTPRINT';
  description: string;
  axiom_correction: string;
}

export interface AuditScore {
  structural_accuracy: number;
  spatial_geometry: number;
  staircase_fidelity: number;
  deck_accuracy: number;
  south_wall_solidity: number;
  render_quality: number;
  total: number;
}

export interface RenderResult {
  id: string;
  imageUrl: string;
  selfScoreText: string;
  auditText?: string;
  auditFailures?: AuditFailure[];
  auditScore?: AuditScore;
  isValidated: boolean;
  status: 'VERIFIED' | 'VIOLATION' | 'PENDING';
  request: RenderRequest;
  timestamp: number;
  refinementPass?: number;
}

export interface LibraryItem {
  id: string;
  title: string;
  content: string;
  category: 'A' | 'B'; 
  isActive: boolean;
}
