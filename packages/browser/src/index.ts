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
  // Single-pass tag stripper (no regex tag filters — regex cannot reliably
  // parse HTML). Removes script/style content and all tags for text extraction.
  const lower = html.toLowerCase();
  let text = '';
  let i = 0;
  while (i < html.length) {
    if (lower.startsWith('<script', i)) {
      const end = lower.indexOf('</script>', i);
      i = end === -1 ? html.length : end + 9;
      text += ' ';
    } else if (lower.startsWith('<style', i)) {
      const end = lower.indexOf('</style>', i);
      i = end === -1 ? html.length : end + 8;
      text += ' ';
    } else if (html[i] === '<') {
      const end = html.indexOf('>', i);
      i = end === -1 ? html.length : end + 1;
      text += ' ';
    } else {
      text += html[i];
      i++;
    }
  }
  return text.replace(/\s+/g, ' ').trim();
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
