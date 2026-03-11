import * as vscode from 'vscode';
import { getConfig, updateDefaultLanguage } from '../config';
import { CodeReplaceService } from '../services/codeReplaceService';
import { LanguageDetectionService } from '../services/languageDetectionService';
import { LocaleService } from '../services/localeService';

export function createExtractCommand(
  localeService: LocaleService,
  codeReplaceService: CodeReplaceService,
  languageDetectionService: LanguageDetectionService
): () => Promise<void> {
  return async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      void vscode.window.showWarningMessage('No active editor.');
      return;
    }

    const selectedText = editor.document.getText(editor.selection).trim();
    if (!selectedText) {
      void vscode.window.showWarningMessage('Select text inside a TSX string literal or JSX text first.');
      return;
    }

    const key = await vscode.window.showInputBox({
      prompt: 'Enter i18n key',
      value: selectedText.toLowerCase().replace(/[^\w\u4e00-\u9fa5]+/g, '.').replace(/^\.+|\.+$/g, '')
    });
    if (!key) {
       void vscode.window.showWarningMessage('Please input a key.');
      return;
    }

    const target = codeReplaceService.getExtractTarget(editor.document, editor.selection, key);
    if (!target) {
      void vscode.window.showErrorMessage('Selection must be fully inside a string literal or JSX text node.');
      return;
    }

    const config = getConfig();
    const detectedLanguage = languageDetectionService.detectLanguage(target.text, config.languages);
    let sourceLanguage = config.defaultLanguage;

    if (detectedLanguage && detectedLanguage !== config.defaultLanguage) {
      const action = await vscode.window.showWarningMessage(
        `Detected language "${detectedLanguage}" does not match defaultLanguage "${config.defaultLanguage}".`,
        'Use Detected Language',
        'Keep Default Language',
        'Open Settings'
      );

      if (action === 'Open Settings') {
        await vscode.commands.executeCommand(
          'workbench.action.openSettings',
          '@ext:i18n-workflow-helper i18nWorkflow.defaultLanguage'
        );
        return;
      }

      sourceLanguage = action === 'Use Detected Language' ? detectedLanguage : config.defaultLanguage;
      if (action === 'Use Detected Language') {
        await updateDefaultLanguage(detectedLanguage, editor.document.uri);
      }
    }

    const keyUsages = await localeService.getKeyUsages(key);
    const conflict = keyUsages.find(
      (entry) => entry.value !== undefined && entry.value !== '' && entry.value !== target.text
    );
    if (conflict) {
      const decision = await vscode.window.showWarningMessage(
        `Key "${key}" already exists in ${conflict.language} with a different value.`,
        { modal: true },
        'Overwrite',
        'Cancel'
      );
      if (decision !== 'Overwrite') {
        return;
      }
    }

    await localeService.ensureKey(key, target.text, sourceLanguage);
    const replaced = await codeReplaceService.replaceSelection(editor.document, target);
    if (replaced) {
      void vscode.window.showInformationMessage(
        `Extracted "${target.text}" to ${key}, wrote value into ${sourceLanguage}, and synced defaultLanguage.`
      );
    }
  };
}
