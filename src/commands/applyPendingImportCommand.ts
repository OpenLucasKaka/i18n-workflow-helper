import * as vscode from 'vscode';
import { getConfig } from '../config';
import { ImportPreviewContentProvider } from '../providers/importPreviewContentProvider';
import { LocaleService } from '../services/localeService';
import { PendingImportSession } from '../types';

export function createApplyPendingImportCommand(
  localeService: LocaleService,
  previewProvider: ImportPreviewContentProvider,
  pendingImport: { current?: PendingImportSession }
): () => Promise<void> {
  return async () => {
    const session = pendingImport.current;
    if (!session) {
      void vscode.window.showWarningMessage('No pending import preview found.');
      return;
    }

    const count = await localeService.applyImportDiff(session.language, session.diff);
    if (session.language === getConfig(session.targetUri).defaultLanguage) {
      await localeService.syncLocaleStructure(session.targetUri, { createMissingFiles: true });
    }
    previewProvider.delete(session.previewUri);
    pendingImport.current = undefined;
    void vscode.window.showInformationMessage(`Imported ${count} key(s) into ${session.language}.`);
  };
}
