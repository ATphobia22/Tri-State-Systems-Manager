// Type declarations for optional dependencies
// These are dynamically imported — not required at build time

declare module '@mlc-ai/web-llm' {
  export function CreateMLCEngine(
    model: string,
    options?: { initProgressCallback?: (report: any) => void }
  ): Promise<any>;
}
