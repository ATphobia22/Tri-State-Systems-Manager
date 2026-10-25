declare module 'node:crypto' { export function randomUUID(): string; export function createHash(algorithm: string): { update(data: string | Uint8Array): { digest(encoding: 'hex'): string } }; }
