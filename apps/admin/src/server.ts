// @tsm-uacf/admin server entry (scaffold). Not wired until configured.
import { ADMIN_APP_ID, ADMIN_APP_VERSION } from './index.ts';

const port = Number(process.env.UACF_ADMIN_PORT ?? 0);
if (!port) {
  throw new Error('UACF_ADMIN_PORT is not configured — admin surface stays disabled (fail-closed).');
}
console.log(`${ADMIN_APP_ID} v${ADMIN_APP_VERSION} listening on :${port}`);
