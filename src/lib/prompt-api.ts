export type LanguageModelAvailability =
  | 'unavailable'
  | 'downloadable'
  | 'downloading'
  | 'available';

export interface LanguageModelExpectedMedia {
  type: 'text' | 'image' | 'audio';
  languages?: string[];
}

export interface LanguageModelCreateOptions {
  expectedInputs?: LanguageModelExpectedMedia[];
  expectedOutputs?: LanguageModelExpectedMedia[];
  initialPrompts?: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  temperature?: number;
  topK?: number;
  signal?: AbortSignal;
}

export type LanguageModelAvailabilityOptions = Pick<
  LanguageModelCreateOptions,
  'expectedInputs' | 'expectedOutputs' | 'signal'
>;

export interface LanguageModelSession {
  prompt(
    input: string,
    options?: { responseConstraint?: unknown; signal?: AbortSignal },
  ): Promise<string>;
  destroy(): void;
}

export interface LanguageModelStatic {
  availability(
    options?: LanguageModelAvailabilityOptions,
  ): Promise<LanguageModelAvailability>;
  create(options?: LanguageModelCreateOptions): Promise<LanguageModelSession>;
  params?: () => Promise<{
    defaultTopK: number;
    maxTopK: number;
    defaultTemperature: number;
    maxTemperature: number;
  }>;
}

/**
 * Chrome Prompt API currently allowlists de/en/es/fr/ja for expectedOutputs.
 * Passing en silences the "no output language" warning; it does not force
 * English completions. System/user prompts stay in Chinese.
 */
export function promptApiSessionOptions(): Pick<
  LanguageModelCreateOptions,
  'expectedInputs' | 'expectedOutputs'
> {
  return {
    expectedInputs: [{ type: 'text', languages: ['en'] }],
    expectedOutputs: [{ type: 'text', languages: ['en'] }],
  };
}

export function getLanguageModel(): LanguageModelStatic | undefined {
  const g = globalThis as unknown as {
    LanguageModel?: LanguageModelStatic;
    ai?: { languageModel?: LanguageModelStatic };
  };
  return g.LanguageModel ?? g.ai?.languageModel;
}
