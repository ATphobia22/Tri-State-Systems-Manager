/**
 * TSM Offline AI Assistant — in-browser LLM via WebGPU.
 *
 * Uses web-llm (https://github.com/mlc-ai/web-llm) for fully offline
 * natural language interaction with the TSM console. No server, no API
 * keys, no network calls after model download. Runs entirely in the
 * user's browser via WebGPU.
 *
 * This fits TSM's constraints:
 *  - Local-first: model runs on-device
 *  - Air-gapped: works without internet after initial download
 *  - No lock-in: open weights, runs in any modern browser
 *  - No PAYG: zero inference cost
 *
 * Use cases:
 *  - "What's the flood stage at Old Shawneetown?"
 *  - "Show me buildings in the 100-year floodplain"
 *  - "Explain what LOD2 means"
 *  - Plain-language help for all ages (your UI direction)
 *
 * Model: Llama-3.2-3B-Instruct (default, ~2GB) or smaller
 *   Smaller options: SmolLM2-1.7B (~1GB), Qwen2.5-1.5B
 *
 * Usage:
 *   import { TSMAssistant } from './offline-assistant';
 *   const assistant = new TSMAssistant();
 *   await assistant.init();  // downloads model on first run
 *   const answer = await assistant.ask("What's the BFE at the anchor site?");
 */

export interface AssistantOptions {
  /** Model ID from web-llm's model list */
  model?: string;
  /** System prompt defining the assistant's role */
  systemPrompt?: string;
  /** Callback for streaming tokens */
  onToken?: (token: string) => void;
}

const DEFAULT_MODEL = 'Llama-3.2-3B-Instruct-q4f16_1-MLC';
const FALLBACK_MODEL = 'SmolLM2-1.7B-Instruct-q4f16_1-MLC';

const TSM_SYSTEM_PROMPT = `You are the TSM Assistant, a helpful guide for the Tri-State Systems Manager.

The Tri-State Systems Manager is an open-source regional operating system for the Ohio-Wabash River Valley (Indiana, Illinois, Kentucky). It provides flood forecasting, 3D terrain visualization, building data, and critical infrastructure mapping.

Key facts:
- Anchor site: 13101 Bonebank Road, Point Township, Posey County, Indiana
- 8 counties: Posey, Vanderburgh, Gibson, Warrick (IN); Gallatin, White (IL); Henderson, Union (KY)
- Key gages: Ohio River at Old Shawneetown (03381700), Wabash at New Harmony (03378500)
- Flood stage at Mount Vernon: 35.0 ft
- Data is real and sourced from USGS, NOAA, USACE, Indiana DNR
- Human authority is final — you inform, never decide

Explain things in plain language for all ages. Be concise. If you don't know something, say so honestly — never invent data.`;

export class TSMAssistant {
  private engine: any = null;
  private initialized = false;
  private model: string;

  constructor(options: AssistantOptions = {}) {
    this.model = options.model || DEFAULT_MODEL;
  }

  /**
   * Initialize the engine. Downloads the model on first run (~2GB).
   * Subsequent runs load from browser cache.
   */
  async init(
    onProgress?: (progress: number, text: string) => void
  ): Promise<void> {
    if (this.initialized) return;

    // Dynamic import — web-llm is large, don't bundle it
    // Install: npm install @mlc-ai/web-llm
    const { CreateMLCEngine } = await import('@mlc-ai/web-llm');

    const initProgressCallback = (report: any) => {
      onProgress?.(report.progress, report.text);
    };

    try {
      this.engine = await CreateMLCEngine(this.model, {
        initProgressCallback,
      });
    } catch (e) {
      console.warn(`Failed to load ${this.model}, trying ${FALLBACK_MODEL}`);
      this.engine = await CreateMLCEngine(FALLBACK_MODEL, {
        initProgressCallback,
      });
      this.model = FALLBACK_MODEL;
    }

    this.initialized = true;
    console.log(`TSM Assistant ready (model: ${this.model})`);
  }

  /**
   * Check if WebGPU is available (required for web-llm).
   */
  static isSupported(): boolean {
    return typeof navigator !== 'undefined' && 'gpu' in navigator;
  }

  /**
   * Ask a question. Returns the complete response.
   */
  async ask(question: string): Promise<string> {
    if (!this.initialized) {
      throw new Error('Call init() first');
    }

    const messages = [
      { role: 'system', content: TSM_SYSTEM_PROMPT },
      { role: 'user', content: question },
    ];

    const response = await this.engine.chat.completions.create({ messages });
    return response.choices[0]?.message?.content || '';
  }

  /**
   * Ask with streaming. Calls onToken for each generated token.
   */
  async askStream(
    question: string,
    onToken: (token: string) => void
  ): Promise<string> {
    if (!this.initialized) {
      throw new Error('Call init() first');
    }

    const messages = [
      { role: 'system', content: TSM_SYSTEM_PROMPT },
      { role: 'user', content: question },
    ];

    const stream = await this.engine.chat.completions.create({
      messages,
      stream: true,
    });

    let full = '';
    for await (const chunk of stream) {
      const token = chunk.choices[0]?.delta?.content || '';
      full += token;
      onToken(token);
    }
    return full;
  }

  /**
   * Inject live TSM context (current gage readings, etc.) into the prompt.
   * Call this before ask() to give the assistant current data.
   */
  async askWithContext(
    question: string,
    context: Record<string, string>
  ): Promise<string> {
    const contextStr = Object.entries(context)
      .map(([k, v]) => `${k}: ${v}`)
      .join('\n');

    const enriched = `${question}\n\nCurrent data:\n${contextStr}`;
    return this.ask(enriched);
  }
}

/**
 * Example: wire to TSM gage data
 *
 * const assistant = new TSMAssistant();
 * await assistant.init((p, t) => updateProgressBar(p));
 *
 * // When user clicks "Fetch live snapshot" (your river-data policy):
 * const gageData = await fetchGageSnapshot(); // your existing function
 * const answer = await assistant.askWithContext(
 *   "Are we near flood stage?",
 *   {
 *     "Ohio at Old Shawneetown": `${gageData.ohio_ft} ft`,
 *     "Flood stage (Mt Vernon)": "35.0 ft",
 *     "Wabash at New Harmony": `${gageData.wabash_ft} ft`,
 *   }
 * );
 */
