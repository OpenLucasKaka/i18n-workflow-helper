import * as vscode from 'vscode';

export type ProblemType =
  | 'hardcoded-text'
  | 'missing-key'
  | 'unused-key'
  | 'locale-mismatch';

export type ProblemFilter = 'all' | ProblemType;

export interface I18nConfig {
  localeDir: string;
  defaultLanguage: string;
  languages: string[];
  functionName: string;
  include: string[];
  exclude: string[];
}

export interface ScanProblem {
  type: ProblemType;
  message: string;
  severity: vscode.DiagnosticSeverity;
  uri?: vscode.Uri;
  range?: vscode.Range;
  key?: string;
  language?: string;
}

export interface ScanSummary {
  workspaceRoots: string[];
  includePatterns: string[];
  excludePatterns: string[];
  scannedFiles: string[];
  skippedFiles: string[];
  unmatchedFiles: string[];
  cacheHits?: number;
  cacheMisses?: number;
}

export interface ExtractTarget {
  range: vscode.Range;
  text: string;
  replacement: string;
}

export interface LocaleFileSummary {
  language: string;
  uri: vscode.Uri;
  keyCount: number;
  exists: boolean;
}

export interface ImportDiffEntry {
  key: string;
  previousValue?: string;
  nextValue: string;
  status: 'added' | 'updated' | 'unchanged';
}

export interface LocaleKeyUsage {
  language: string;
  value?: string;
}

export interface LocaleDirectorySummary {
  relativePath: string;
  absolutePath: string;
  exists: boolean;
}

export interface ImportPreviewResult {
  targetUri: vscode.Uri;
  previewContent: string;
  diff: ImportDiffEntry[];
}

export interface PendingImportSession {
  id: string;
  language: string;
  previewUri: vscode.Uri;
  targetUri: vscode.Uri;
  diff: ImportDiffEntry[];
}
