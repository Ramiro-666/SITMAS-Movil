import type { Coordinate, RouteStop } from '../../services/route-geometry';
export type RouteCanvasProps = {
  points: RouteStop[];
  paths: Coordinate[][];
  selectedId: number | null;
  fitVersion: number;
  onSelect: (id: number) => void;
};
