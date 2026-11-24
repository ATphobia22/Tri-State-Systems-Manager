/**
 * Route network and simple stakeholder agent contracts.
 * Educational / scenario only.
 */

export interface RouteNode {
  id: string;
  position: [number, number, number];
  label?: string;
}

export interface RouteEdge {
  from: string;
  to: string;
  cost: number; // travel time or distance units
  kind: "road" | "drone" | "emergency" | "maintenance";
}

export interface RouteNetwork {
  id: string;
  nodes: RouteNode[];
  edges: RouteEdge[];
  presentationOnly: true;
}

export interface StakeholderAgent {
  id: string;
  role: "landowner" | "farmer" | "county_staff" | "emergency";
  favor: number; // 0..1
  schedule: Array<{ hour: number; activity: string }>;
  presentationOnly: true;
}
