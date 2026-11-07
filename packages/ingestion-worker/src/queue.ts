export type QueueFactory = (name: string) => {
  add: (jobName: string, data: Record<string, unknown>) => Promise<unknown>;
};

export const INGESTION_QUEUE_NAME = 'tsm-ingestion';

export function createIngestionQueue(factory: QueueFactory) {
  return factory(INGESTION_QUEUE_NAME);
}
