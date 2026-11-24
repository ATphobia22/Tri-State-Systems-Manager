/**
 * Camera path contracts for cinematic and multi-POV viewing.
 * Positions must be in an existing TSM scene CRS (ECEF or local).
 * Never invents datum transforms.
 */

export interface CameraNode {
  position: [number, number, number];
  orientation: [number, number, number, number]; // quaternion w,x,y,z or x,y,z,w — document convention at call site
  fov: number;
  durationMs: number;
  label?: string;
  nearClip?: number;
  farClip?: number;
}

export interface CameraPath {
  id: string;
  name: string;
  nodes: CameraNode[];
  boundEvidenceIds: string[];
  loop: boolean;
  presentationOnly: true;
}

export interface CameraPathPlayerOptions {
  onNodeEnter?: (nodeIndex: number, node: CameraNode) => void;
  onComplete?: () => void;
}
