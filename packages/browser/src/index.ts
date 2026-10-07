export interface BrowserPage {
  url: string;
  title: string;
  text: string;
}

export interface BrowserFetchOptions {
  timeoutMs?: number;
  userAgent?: string;
}

export interface BrowserClient {
  fetchText(url: string, options?: BrowserFetchOptions): Promise<BrowserPage>;
}

function stripTags(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export class HttpBrowserClient implements BrowserClient {
  public async fetchText(url: string, options: BrowserFetchOptions = {}): Promise<BrowserPage> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 30_000);
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: { "User-Agent": options.userAgent ?? "tsm-uacf-browser/0.1.0" },
      });
      if (!response.ok) {
        throw new Error(`Browser fetch failed: ${response.status} ${url}`);
      }
      const html = await response.text();
      const title = html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim() ?? "";
      return { url, title, text: stripTags(html) };
    } finally {
      clearTimeout(timer);
    }
  }
}
