import * as ts from 'typescript';
import * as vscode from 'vscode';

const FILE_EXTENSION_TO_SCRIPT_KIND = new Map<string, ts.ScriptKind>([
  ['.js', ts.ScriptKind.JS],
  ['.jsx', ts.ScriptKind.JSX],
  ['.ts', ts.ScriptKind.TS],
  ['.tsx', ts.ScriptKind.TSX],
  ['.mjs', ts.ScriptKind.JS],
  ['.cjs', ts.ScriptKind.JS],
  ['.mts', ts.ScriptKind.TS],
  ['.cts', ts.ScriptKind.TS]
]);

const SUPPORTED_LANGUAGE_IDS = new Set([
  'javascript',
  'javascriptreact',
  'typescript',
  'typescriptreact',
  'vue'
]);

export function getScriptKind(document: vscode.TextDocument): ts.ScriptKind {
  for (const [extension, kind] of FILE_EXTENSION_TO_SCRIPT_KIND.entries()) {
    if (document.fileName.endsWith(extension)) {
      return kind;
    }
  }

  switch (document.languageId) {
    case 'javascriptreact':
      return ts.ScriptKind.JSX;
    case 'typescriptreact':
      return ts.ScriptKind.TSX;
    case 'javascript':
      return ts.ScriptKind.JS;
    case 'typescript':
      return ts.ScriptKind.TS;
    default:
      return ts.ScriptKind.Unknown;
  }
}

export function supportsExtraction(document: vscode.TextDocument): boolean {
  return document.fileName.endsWith('.vue') || getScriptKind(document) !== ts.ScriptKind.Unknown;
}

export function supportsCodeActions(languageId: string): boolean {
  return SUPPORTED_LANGUAGE_IDS.has(languageId);
}
