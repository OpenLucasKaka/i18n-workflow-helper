export class LanguageDetectionService {
  detectLanguage(text: string, configuredLanguages: string[]): string | undefined {
    const normalized = text.trim();
    if (!normalized) {
      return;
    }

    const hasCjk = /[\u3400-\u9fff]/.test(normalized);
    const hasKana = /[\u3040-\u30ff]/.test(normalized);
    const hasHangul = /[\uac00-\ud7af]/.test(normalized);
    const hasLatin = /[A-Za-z]/.test(normalized);

    if (hasKana) {
      return this.findConfiguredLanguage(configuredLanguages, ['ja', 'ja-JP']);
    }
    if (hasHangul) {
      return this.findConfiguredLanguage(configuredLanguages, ['ko', 'ko-KR']);
    }
    if (hasCjk) {
      return this.findConfiguredLanguage(configuredLanguages, ['zh', 'zh-CN', 'zh-TW', 'zh-HK']);
    }
    if (hasLatin) {
      return this.findConfiguredLanguage(configuredLanguages, ['en', 'en-US', 'en-GB']);
    }

    return;
  }

  private findConfiguredLanguage(configuredLanguages: string[], candidates: string[]): string | undefined {
    for (const candidate of candidates) {
      const exact = configuredLanguages.find((language) => language.toLowerCase() === candidate.toLowerCase());
      if (exact) {
        return exact;
      }
    }

    for (const candidate of candidates) {
      const prefix = configuredLanguages.find((language) =>
        language.toLowerCase().startsWith(candidate.toLowerCase().split('-')[0])
      );
      if (prefix) {
        return prefix;
      }
    }

    return;
  }
}
