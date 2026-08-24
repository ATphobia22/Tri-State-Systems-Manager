export interface SpatialPoint { readonly x: number; readonly y: number; readonly z?: number; }

export class SpatialHash<T extends SpatialPoint> {
  private readonly cells = new Map<string, Set<T>>();

  constructor(private readonly cellSize: number) {
    if (!Number.isFinite(cellSize) || cellSize <= 0) throw new RangeError('cellSize must be finite and positive');
  }

  private key(point: SpatialPoint): string {
    return `${Math.floor(point.x / this.cellSize)}:${Math.floor(point.y / this.cellSize)}:${Math.floor((point.z ?? 0) / this.cellSize)}`;
  }

  insert(item: T): void {
    const key = this.key(item);
    const cell = this.cells.get(key) ?? new Set<T>();
    cell.add(item);
    this.cells.set(key, cell);
  }

  remove(item: T): boolean {
    const key = this.key(item);
    const cell = this.cells.get(key);
    if (!cell) return false;
    const removed = cell.delete(item);
    if (cell.size === 0) this.cells.delete(key);
    return removed;
  }

  queryRadius(center: SpatialPoint, radius: number): T[] {
    if (!Number.isFinite(radius) || radius < 0) throw new RangeError('radius must be finite and non-negative');
    const result: T[] = [];
    const minX = Math.floor((center.x - radius) / this.cellSize);
    const maxX = Math.floor((center.x + radius) / this.cellSize);
    const minY = Math.floor((center.y - radius) / this.cellSize);
    const maxY = Math.floor((center.y + radius) / this.cellSize);
    const minZ = Math.floor(((center.z ?? 0) - radius) / this.cellSize);
    const maxZ = Math.floor(((center.z ?? 0) + radius) / this.cellSize);
    const radiusSquared = radius * radius;

    for (let x = minX; x <= maxX; x += 1) for (let y = minY; y <= maxY; y += 1) for (let z = minZ; z <= maxZ; z += 1) {
      const cell = this.cells.get(`${x}:${y}:${z}`);
      if (!cell) continue;
      for (const item of cell) {
        const dx = item.x - center.x;
        const dy = item.y - center.y;
        const dz = (item.z ?? 0) - (center.z ?? 0);
        if (dx * dx + dy * dy + dz * dz <= radiusSquared) result.push(item);
      }
    }
    return result;
  }

  clear(): void { this.cells.clear(); }
  get size(): number { let total = 0; for (const cell of this.cells.values()) total += cell.size; return total; }
}
