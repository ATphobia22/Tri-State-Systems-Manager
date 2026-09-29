/**
 * preload.mjs — minimal, audited bridge. The renderer gets zero Node access;
 * it talks to the local API over loopback HTTP like the web build does.
 */
import { contextBridge } from 'electron';

contextBridge.exposeInMainWorld('tsmDesktop', {
  platform: process.platform,
  versions: {
    app: '0.2.1',
  },
});
