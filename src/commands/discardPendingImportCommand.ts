import * as vscode from 'vscode';
import { ImportPreviewContentProvider } from '../providers/importPreviewContentProvider';
import { PendingImportSession } from '../types';

export function createDiscardPendingImportCommand(
  previewProvider: ImportPreviewContentProvider,
  pendingImport: { current?: PendingImportSession }
): () => Promise<void> {
  return async () => {
    const session = pendingImport.current;
    if (!session) {
      void vscode.window.showWarningMessage('No pending import preview found.');
      return;
    }

    previewProvider.delete(session.previewUri);
    pendingImport.current = undefined;
    void vscode.window.showInformationMessage(`Discarded import preview for ${session.language}.`);
  };
}
