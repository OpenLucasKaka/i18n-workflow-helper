import * as vscode from 'vscode';
import { applyEdits, format, modify, parse } from 'jsonc-parser';
import { getConfig } from '../config';
import {
  ImportDiffEntry,
  ImportPreviewResult,
  LocaleDirectorySummary,
  LocaleFileSummary,
  LocaleKeyUsage
} from '../types';
import { flattenObject } from '../utils';

export class LocaleService {
  private readonly encoder = new TextEncoder();
  private readonly decoder = new TextDecoder();

  async ensureKey(key: string, value: string, sourceLanguage?: string): Promise<void> {
    const config = getConfig();
    const resolvedSourceLanguage =
      sourceLanguage && config.languages.includes(sourceLanguage) ? sourceLanguage : config.defaultLanguage;

    for (const language of config.languages) {
      const localeUri = this.getLocaleFileUri(language);
      const root = await this.readLocaleObject(localeUri);
      const flat = flattenObject(root.data);
      const existingValue = flat[key];
      const shouldWriteValue = language === resolvedSourceLanguage;
      const nextValue = shouldWriteValue ? value : existingValue ?? '';

      if (existingValue !== undefined && (!shouldWriteValue || existingValue === value)) {
        continue;
      }

      const updated = this.updateJsonContent(root.raw, key.split('.'), nextValue);
      await vscode.workspace.fs.writeFile(localeUri, this.encoder.encode(updated));
    }
  }

  async ensureLocaleFiles(): Promise<void> {
    const config = getConfig();
    for (const language of config.languages) {
      const localeUri = this.getLocaleFileUri(language);
      await this.readLocaleObject(localeUri);
    }
  }

  async syncLocaleStructure(): Promise<void> {
    const config = getConfig();
    const locales = await this.readAllLocales();
    const defaultLocale = locales.get(config.defaultLanguage) ?? {};

    for (const language of config.languages) {
      if (language === config.defaultLanguage) {
        continue;
      }
      const localeUri = this.getLocaleFileUri(language);
      const current = await this.readLocaleObject(localeUri);
      let raw = current.raw;
      const existing = flattenObject(current.data);
      let changed = false;
      for (const key of Object.keys(defaultLocale)) {
        if (key in existing) {
          continue;
        }
        raw = this.updateJsonContent(raw, key.split('.'), '');
        changed = true;
      }
      if (changed) {
        await vscode.workspace.fs.writeFile(localeUri, this.encoder.encode(raw));
      }
    }
  }

  async readAllLocales(): Promise<Map<string, Record<string, string>>> {
    const config = getConfig();
    const result = new Map<string, Record<string, string>>();
    for (const language of config.languages) {
      const localeUri = this.getLocaleFileUri(language);
      const root = await this.readLocaleObject(localeUri);
      result.set(language, flattenObject(root.data));
    }
    return result;
  }

  async exportLocales(targetFolder: vscode.Uri, languages?: string[]): Promise<vscode.Uri[]> {
    await this.ensureLocaleFiles();
    await this.syncLocaleStructure();
    const config = getConfig();
    const writtenFiles: vscode.Uri[] = [];
    const targetLanguages = languages?.length ? languages : config.languages;

    await vscode.workspace.fs.createDirectory(targetFolder);
    for (const language of targetLanguages) {
      const sourceUri = this.getLocaleFileUri(language);
      const source = await this.readLocaleObject(sourceUri);
      const exportUri = vscode.Uri.joinPath(targetFolder, `${language}.json`);
      const content = `${JSON.stringify(source.data, null, 2)}\n`;
      await vscode.workspace.fs.writeFile(exportUri, this.encoder.encode(content));
      writtenFiles.push(exportUri);
    }

    return writtenFiles;
  }

  async previewImport(language: string, fileUri: vscode.Uri): Promise<ImportDiffEntry[]> {
    const targetUri = this.getLocaleFileUri(language);
    const incomingRaw = this.decoder.decode(await vscode.workspace.fs.readFile(fileUri));
    const incomingData = (parse(incomingRaw) as Record<string, unknown>) ?? {};
    const incomingEntries = this.normalizeEntries(incomingData);
    const current = await this.readLocaleObject(targetUri);
    const currentEntries = flattenObject(current.data);

    return Object.entries(incomingEntries)
      .map(([key, nextValue]) => {
        const previousValue = currentEntries[key];
        const status: ImportDiffEntry['status'] =
          previousValue === undefined ? 'added' : previousValue === nextValue ? 'unchanged' : 'updated';
        return { key, previousValue, nextValue, status };
      })
      .sort((left, right) => left.key.localeCompare(right.key));
  }

  async buildImportPreview(language: string, fileUri: vscode.Uri): Promise<ImportPreviewResult> {
    const targetUri = this.getLocaleFileUri(language);
    const diff = await this.previewImport(language, fileUri);
    const current = await this.readLocaleObject(targetUri);
    let raw = current.raw;

    for (const entry of diff) {
      if (entry.status === 'unchanged') {
        continue;
      }
      raw = this.updateJsonContent(raw, entry.key.split('.'), entry.nextValue);
    }

    return {
      targetUri,
      previewContent: raw,
      diff
    };
  }

  async importLanguageFile(language: string, fileUri: vscode.Uri): Promise<number> {
    const diff = await this.previewImport(language, fileUri);
    return this.applyImportDiff(language, diff);
  }

  async applyImportDiff(language: string, diff: ImportDiffEntry[]): Promise<number> {
    const targetUri = this.getLocaleFileUri(language);
    const current = await this.readLocaleObject(targetUri);
    let raw = current.raw;
    let updatedCount = 0;

    for (const entry of diff) {
      if (entry.status === 'unchanged') {
        continue;
      }
      raw = this.updateJsonContent(raw, entry.key.split('.'), entry.nextValue);
      updatedCount += 1;
    }

    if (updatedCount > 0) {
      await vscode.workspace.fs.writeFile(targetUri, this.encoder.encode(raw));
    }
    return updatedCount;
  }

  async getLocaleFileSummaries(): Promise<LocaleFileSummary[]> {
    const config = getConfig();
    const summaries: LocaleFileSummary[] = [];

    for (const language of config.languages) {
      const uri = this.getLocaleFileUri(language);
      try {
        const file = await this.readLocaleObject(uri);
        summaries.push({
          language,
          uri,
          keyCount: Object.keys(flattenObject(file.data)).length,
          exists: true
        });
      } catch {
        summaries.push({ language, uri, keyCount: 0, exists: false });
      }
    }

    return summaries;
  }

  getLocaleDirectorySummary(): LocaleDirectorySummary {
    const config = getConfig();
    const folder = vscode.workspace.workspaceFolders?.[0];
    if (!folder) {
      throw new Error('Open a workspace before using i18n workflow commands.');
    }

    const uri = vscode.Uri.joinPath(folder.uri, config.localeDir);
    return {
      relativePath: config.localeDir,
      absolutePath: uri.fsPath,
      exists: this.fileExists(uri)
    };
  }

  async getKeyUsages(key: string): Promise<LocaleKeyUsage[]> {
    const locales = await this.readAllLocales();
    return Array.from(locales.entries()).map(([language, entries]) => ({
      language,
      value: entries[key]
    }));
  }

  getLocaleFileUri(language: string): vscode.Uri {
    return this.resolveLocaleFileUri(language);
  }

  private async readLocaleObject(uri: vscode.Uri): Promise<{ raw: string; data: Record<string, unknown> }> {
    try {
      const content = this.decoder.decode(await vscode.workspace.fs.readFile(uri));
      return { raw: content, data: (parse(content) as Record<string, unknown>) ?? {} };
    } catch {
      const parentPath = uri.path.slice(0, uri.path.lastIndexOf('/'));
      await vscode.workspace.fs.createDirectory(uri.with({ path: parentPath }));
      const raw = '{\n}\n';
      await vscode.workspace.fs.writeFile(uri, this.encoder.encode(raw));
      return { raw, data: {} };
    }
  }

  private updateJsonContent(raw: string, path: string[], value: string): string {
    const edits = modify(raw || '{\n}\n', path, value, {
      formattingOptions: { insertSpaces: true, tabSize: 2 }
    });
    const updated = applyEdits(raw || '{\n}\n', edits);
    return format(updated, undefined, { insertSpaces: true, tabSize: 2 }).reduce(
      (text, edit) => applyEdits(text, [edit]),
      updated
    );
  }

  private normalizeEntries(data: Record<string, unknown>): Record<string, string> {
    const flat = flattenObject(data);
    if (Object.keys(flat).length > 0) {
      return flat;
    }

    const result: Record<string, string> = {};
    for (const [key, value] of Object.entries(data)) {
      if (typeof value === 'string') {
        result[key] = value;
      }
    }
    return result;
  }

  private resolveLocaleFileUri(language: string): vscode.Uri {
    const config = getConfig();
    const folder = vscode.workspace.workspaceFolders?.[0];
    if (!folder) {
      throw new Error('Open a workspace before using i18n workflow commands.');
    }

    const baseUri = vscode.Uri.joinPath(folder.uri, config.localeDir);
    const jsoncUri = vscode.Uri.joinPath(baseUri, `${language}.jsonc`);
    const jsonUri = vscode.Uri.joinPath(baseUri, `${language}.json`);
    return this.fileExists(jsoncUri) ? jsoncUri : jsonUri;
  }

  private fileExists(uri: vscode.Uri): boolean {
    try {
      const fsPath = uri.fsPath;
      return require('fs').existsSync(fsPath);
    } catch {
      return false;
    }
  }
}
