import * as vscode from 'vscode';
import { getConfig } from '../config';
import { LocaleService } from '../services/localeService';

export function createExportLocalesCommand(localeService: LocaleService): () => Promise<void> {
  return async () => {
    const config = getConfig();
    const languageChoice = await vscode.window.showQuickPick(
      [
        { label: 'All languages', value: '__all__' },
        ...config.languages.map((language) => ({ label: language, value: language }))
      ],
      {
        placeHolder: 'Choose which language files to export'
      }
    );

    if (!languageChoice) {
      return;
    }

    const target = await vscode.window.showOpenDialog({
      canSelectFiles: false,
      canSelectFolders: true,
      canSelectMany: false,
      openLabel: 'Export Locale JSON Files'
    });

    if (!target?.[0]) {
      return;
    }

    const selectedLanguages = languageChoice.value === '__all__' ? undefined : [languageChoice.value];
    const files = await localeService.exportLocales(target[0], selectedLanguages);
    void vscode.window.showInformationMessage(
      `Exported ${files.length} locale file(s) to ${target[0].fsPath}.`
    );
  };
}
