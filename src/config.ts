import * as vscode from 'vscode';
import { applyEdits, format, modify, parse } from 'jsonc-parser';
import { I18nConfig } from './types';

export function getConfig(): I18nConfig {
  const config = vscode.workspace.getConfiguration('i18nWorkflow');
  return {
    localeDir: config.get<string>('localeDir', 'src/locales'),
    defaultLanguage: config.get<string>('defaultLanguage', 'en'),
    languages: config.get<string[]>('languages', ['en', 'zh-CN']),
    functionName: config.get<string>('functionName', 't'),
    include: config.get<string[]>('include', ['src/**/*.tsx']),
    exclude: config.get<string[]>('exclude', ['**/node_modules/**', '**/dist/**'])
  };
}

export async function updateDefaultLanguage(language: string, resource?: vscode.Uri): Promise<void> {
  await updateWorkspaceSetting('i18nWorkflow.defaultLanguage', language, resource);
}

export async function updateLocaleDir(localeDir: string, resource?: vscode.Uri): Promise<void> {
  await updateWorkspaceSetting('i18nWorkflow.localeDir', localeDir, resource);
}

async function updateWorkspaceSetting(key: string, value: string, resource?: vscode.Uri): Promise<void> {
  const folder = resource
    ? vscode.workspace.getWorkspaceFolder(resource) ?? vscode.workspace.workspaceFolders?.[0]
    : vscode.workspace.workspaceFolders?.[0];

  if (!folder) {
    throw new Error('No workspace folder found for updating defaultLanguage.');
  }

  const settingsDir = vscode.Uri.joinPath(folder.uri, '.vscode');
  const settingsFile = vscode.Uri.joinPath(settingsDir, 'settings.json');
  await vscode.workspace.fs.createDirectory(settingsDir);

  let raw = '{\n}\n';
  try {
    raw = Buffer.from(await vscode.workspace.fs.readFile(settingsFile)).toString('utf8');
  } catch {
    raw = '{\n}\n';
  }

  const edits = modify(raw, key.split('.'), value, {
    formattingOptions: { insertSpaces: true, tabSize: 2 }
  });
  const updated = applyEdits(raw, edits);
  const formatted = format(updated, undefined, { insertSpaces: true, tabSize: 2 }).reduce(
    (text, edit) => applyEdits(text, [edit]),
    updated
  );

  await vscode.workspace.fs.writeFile(settingsFile, Buffer.from(formatted, 'utf8'));

  const confirmedRaw = Buffer.from(await vscode.workspace.fs.readFile(settingsFile)).toString('utf8');
  const confirmed = parse(confirmedRaw) as Record<string, unknown>;
  const confirmedValue = key.split('.').reduce<unknown>((current, segment) => {
    if (!current || typeof current !== 'object') {
      return undefined;
    }
    return (current as Record<string, unknown>)[segment];
  }, confirmed);
  if (confirmedValue !== value) {
    throw new Error(`Setting update failed for "${key}". Expected "${value}", got "${String(confirmedValue ?? '')}".`);
  }
}
