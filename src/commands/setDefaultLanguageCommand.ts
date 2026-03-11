import * as vscode from 'vscode';
import { getConfig, updateDefaultLanguage } from '../config';

export function createSetDefaultLanguageCommand(onChanged?: () => Promise<void>): () => Promise<void> {
  return async () => {
    const config = getConfig();
    const currentValue = config.defaultLanguage;
    const picked = await vscode.window.showQuickPick(
      config.languages.map((language) => ({
        label: language,
        description: language === currentValue ? 'Current default' : undefined
      })),
      {
        placeHolder: 'Select default language from configured languages'
      }
    );

    if (!picked) {
      return;
    }

    const resource = vscode.window.activeTextEditor?.document.uri;
    await updateDefaultLanguage(picked.label, resource);

    if (onChanged) {
      await onChanged();
    }

    void vscode.window.showInformationMessage(`Default language updated to ${picked.label}.`);
  };
}
