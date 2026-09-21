import { createDeadLetterQueue } from './dead-letter-queue.mjs';

export const reliabilityDlq = createDeadLetterQueue({
  filePath: process.env.TSM_DLQ_PATH || undefined,
  maxEntries: Number(process.env.TSM_DLQ_MAX_ENTRIES || 1_000),
});
