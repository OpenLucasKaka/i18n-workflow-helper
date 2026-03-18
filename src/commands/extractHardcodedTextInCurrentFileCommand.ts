import * as vscode from 'vscode';
import { getConfig } from '../config';
import { supportsExtraction } from '../languageSupport';
import { CodeReplaceService } from '../services/codeReplaceService';
import { LocaleService } from '../services/localeService';
import { ProblemScanService } from '../services/problemScanService';
import { ExtractTarget } from '../types';
import { hasKeyPathConflict, suggestKeyFromText, suggestNamespaceFromPath } from '../utils';

type CandidateItem = vscode.QuickPickItem & {
  key: string;
  target: ExtractTarget;
};

export function createExtractHardcodedTextInCurrentFileCommand(
  problemScanService: ProblemScanService,
  localeService: LocaleService,
  codeReplaceService: CodeReplaceService
): () => Promise<void> {
  return async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      void vscode.window.showWarningMessage('No active editor.');
      return;
    }

    if (!supportsExtraction(editor.document)) {
      void vscode.window.showWarningMessage('Current file type is not supported for extraction.');
      return;
    }

    const document = editor.document;
    const problems = await problemScanService.scanDocumentInEditor(document);
    const hardcodedProblems = problems.filter(
      (problem) => problem.type === 'hardcoded-text' && problem.range && problem.uri?.toString() === document.uri.toString()
    );

    if (hardcodedProblems.length === 0) {
      void vscode.window.showInformationMessage('No hardcoded text candidates found in the current file.');
      return;
    }

    const relativePath = vscode.workspace.asRelativePath(document.uri, false);
    const namespace = suggestNamespaceFromPath(relativePath) || 'page';

    const locales = await localeService.readAllLocales(document.uri);
    const existingValues = new Map<string, string>();
    for (const entries of locales.values()) {
      for (const [key, value] of Object.entries(entries)) {
        if (!existingValues.has(key) && value) {
          existingValues.set(key, value);
        }
      }
    }

    const usedKeys = new Set(existingValues.keys());
    const candidates: CandidateItem[] = [];
    for (const [index, problem] of hardcodedProblems.entries()) {
      const selection = new vscode.Selection(problem.range!.start, problem.range!.end);
      const key = buildUniqueKey(namespace, problem.message.replace(/^Hardcoded text:\s*/, ''), usedKeys, existingValues);
      const target = codeReplaceService.getExtractTarget(document, selection, key);
      if (!target) {
        continue;
      }

      usedKeys.add(key);
      candidates.push({
        label: target.text,
        description: key,
        detail: `${vscode.workspace.asRelativePath(document.uri)}:${problem.range!.start.line + 1}`,
        picked: index < 20,
        key,
        target
      });
    }

    if (candidates.length === 0) {
      void vscode.window.showWarningMessage('Found hardcoded text, but none of the ranges could be extracted safely.');
      return;
    }

    const picked = await vscode.window.showQuickPick<CandidateItem>(candidates, {
      canPickMany: true,
      title: 'Extract hardcoded text in current file',
      placeHolder: 'Review the suggested key for each text. Uncheck anything you do not want to extract yet.'
    });

    if (!picked || picked.length === 0) {
      return;
    }

    const config = getConfig(document.uri);
    for (const item of picked) {
      await localeService.ensureKey(item.key, item.target.text, config.defaultLanguage, document.uri);
    }

    const replaced = await codeReplaceService.replaceSelections(
      document,
      picked.map((item) => item.target)
    );

    if (!replaced) {
      void vscode.window.showErrorMessage('Failed to apply one or more code replacements.');
      return;
    }

    void vscode.window.showInformationMessage(
      `Extracted ${picked.length} text item(s) into ${config.defaultLanguage} locale.`
    );
  };
}

function buildUniqueKey(
  namespace: string,
  text: string,
  usedKeys: Set<string>,
  existingValues: Map<string, string>
): string {
  const baseKey = [namespace, suggestKeyFromText(text) || 'text'].filter(Boolean).join('.');
  let candidate = baseKey;
  let suffix = 2;

  while (
    (usedKeys.has(candidate) && existingValues.get(candidate) !== text) ||
    hasKeyPathConflict(candidate, usedKeys)
  ) {
    candidate = `${baseKey}.${suffix}`;
    suffix += 1;
  }

  return candidate;
}
