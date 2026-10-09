export interface FeatureLayerRequest {
  readonly signal: AbortSignal;
  isCurrent(): boolean;
  finish(): void;
}

/**
 * Tracks one active request per feature layer. Requests for independent layers
 * remain valid together; a newer request only supersedes the same layer.
 */
export class FeatureLayerRequestCoordinator {
  private readonly generations = new Map<string, number>();
  private readonly controllers = new Map<string, AbortController>();

  begin(layerId: string): FeatureLayerRequest {
    this.controllers.get(layerId)?.abort();
    const generation = (this.generations.get(layerId) ?? 0) + 1;
    const controller = new AbortController();
    this.generations.set(layerId, generation);
    this.controllers.set(layerId, controller);

    return {
      signal: controller.signal,
      isCurrent: () => !controller.signal.aborted && this.generations.get(layerId) === generation,
      finish: () => {
        if (this.generations.get(layerId) === generation && this.controllers.get(layerId) === controller) {
          this.controllers.delete(layerId);
        }
      },
    };
  }

  cancel(layerId: string): void {
    const controller = this.controllers.get(layerId);
    this.generations.set(layerId, (this.generations.get(layerId) ?? 0) + 1);
    this.controllers.delete(layerId);
    controller?.abort();
  }

  cancelAll(): void {
    for (const layerId of [...this.controllers.keys()]) this.cancel(layerId);
  }
}
