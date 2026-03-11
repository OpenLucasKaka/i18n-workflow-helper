import * as path from 'path';
import * as vscode from 'vscode';
import { updateLocaleDir } from '../config';

export function createSetLocaleDirectoryCommand(onChanged?: () => Promise<void>): () => Promise<void> {
  return async () => {
    const folder = vscode.workspace.workspaceFolders?.[0];
    if (!folder) {
      void vscode.window.showErrorMessage('Open a workspace folder before setting the locale directory.');
      return;
    }

    const picked = await vscode.window.showOpenDialog({
      canSelectFiles: false,
      canSelectFolders: true,
      canSelectMany: false,
      defaultUri: folder.uri,
      openLabel: 'Select Locale Directory'
    });

    if (!picked?.[0]) {
      return;
    }

    const relativePath = path.relative(folder.uri.fsPath, picked[0].fsPath) || '.';
    await updateLocaleDir(relativePath, folder.uri);
    if (onChanged) {
      await onChanged();
    }

    void vscode.window.showInformationMessage(`Locale directory updated to ${relativePath}.`);
  };
}
