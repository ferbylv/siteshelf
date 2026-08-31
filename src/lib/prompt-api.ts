export type LanguageModelAvailability =
  | 'unavailable'
  | 'downloadable'
  | 'downloading'
  | 'available';

export interface LanguageModelSession {
  prompt(
    input: string,
    options?: { responseConstraint?: unknown; signal?: AbortSignal },
  ): Promise<string>;
  destroy(): void;
}

export interface LanguageModelStatic {
  availability(options?: unknown): Promise<LanguageModelAvailability>;
  create(options?: unknown): Promise<LanguageModelSession>;
  params?: () => Promise<{
    defaultTopK: number;
    maxTopK: number;
    defaultTemperature: number;
    maxTemperature: number;
  }>;
}

export function getLanguageModel(): LanguageModelStatic | undefined {
  const g = globalThis as unknown as {
    LanguageModel?: LanguageModelStatic;
    ai?: { languageModel?: LanguageModelStatic };
  };
  return g.LanguageModel ?? g.ai?.languageModel;
}
