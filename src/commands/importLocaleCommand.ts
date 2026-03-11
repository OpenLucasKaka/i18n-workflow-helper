import * as vscode from 'vscode';
import { getConfig } from '../config';
import { ImportPreviewContentProvider } from '../providers/importPreviewContentProvider';
import { LocaleService } from '../services/localeService';
import { PendingImportSession } from '../types';

export function createImportLocaleCommand(
  localeService: LocaleService,
  previewProvider: ImportPreviewContentProvider,
  pendingImport: { current?: PendingImportSession }
): () => Promise<void> {
  return async () => {
    const config = getConfig();
    const language = await vscode.window.showQuickPick(config.languages, {
      placeHolder: 'Choose the language file to update'
    });
    if (!language) {
      return;
    }

    const selectedFile = await vscode.window.showOpenDialog({
      canSelectFiles: true,
      canSelectFolders: false,
      canSelectMany: false,
      filters: {
        'JSON Files': ['json', 'jsonc']
      },
      openLabel: `Import into ${language}`
    });

    if (!selectedFile?.[0]) {
      return;
    }

    const preview = await localeService.buildImportPreview(language, selectedFile[0]);
    const actionable = preview.diff.filter((entry) => entry.status !== 'unchanged');
    if (preview.diff.length === 0) {
      void vscode.window.showWarningMessage('The selected file does not contain any importable locale keys.');
      return;
    }
    if (actionable.length === 0) {
      void vscode.window.showInformationMessage(`No changes detected for ${language}.`);
      return;
    }

    const added = actionable.filter((entry) => entry.status === 'added').length;
    const updated = actionable.filter((entry) => entry.status === 'updated').length;
    const previewUri = vscode.Uri.parse(
      `i18n-preview:${language}/${Date.now()}${preview.targetUri.path.endsWith('.jsonc') ? '.jsonc' : '.json'}`
    );
    previewProvider.set(previewUri, preview.previewContent);
    pendingImport.current = {
      id: String(Date.now()),
      language,
      previewUri,
      targetUri: preview.targetUri,
      diff: actionable
    };

    await vscode.commands.executeCommand(
      'vscode.diff',
      preview.targetUri,
      previewUri,
      `Import Preview: ${language} (${added} added, ${updated} updated)`
    );

    const changedKeysPreview = actionable
      .slice(0, 12)
      .map((entry) => `${entry.status === 'added' ? '+' : '~'} ${entry.key}`)
      .join(', ');

    const action = await vscode.window.showInformationMessage(
      `Import preview ready for ${language}: ${actionable.length} change(s). ${changedKeysPreview}${
        actionable.length > 12 ? ', ...' : ''
      }`,
      'Apply Import',
      'Discard Preview'
    );

    if (action === 'Apply Import') {
      await vscode.commands.executeCommand('i18nWorkflow.applyPendingImport');
      return;
    }

    if (action === 'Discard Preview') {
      await vscode.commands.executeCommand('i18nWorkflow.discardPendingImport');
    }
  };
}
