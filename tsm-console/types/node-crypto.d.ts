declare module 'node:crypto' {
  interface Hash {
    update(data: string, encoding?: BufferEncoding): Hash;
    digest(encoding: 'hex'): string;
  }
  export function createHash(algorithm: string): Hash;
}
