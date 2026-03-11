import * as vscode from 'vscode';
import { CodeReplaceService } from '../services/codeReplaceService';

export class I18nCodeActionProvider implements vscode.CodeActionProvider {
  static readonly providedCodeActionKinds = [vscode.CodeActionKind.QuickFix];
  private readonly codeReplaceService = new CodeReplaceService();

  provideCodeActions(
    document: vscode.TextDocument,
    range: vscode.Range,
    context: vscode.CodeActionContext
  ): vscode.CodeAction[] {
    const selection = new vscode.Selection(range.start, range.end);
    const canExtract = this.codeReplaceService.getExtractTarget(document, selection, '__preview__') !== null;
    const hasHardcodedProblem = context.diagnostics.some(
      (diagnostic) => diagnostic.source === 'i18nWorkflow' && diagnostic.code === 'hardcoded-text'
    );

    if (!canExtract && !hasHardcodedProblem) {
      return [];
    }

    const action = new vscode.CodeAction('Extract to i18n key', vscode.CodeActionKind.QuickFix);
    action.command = {
      command: 'i18nWorkflow.extractTextAtRange',
      title: 'Extract to i18n key',
      arguments: [document.uri, range]
    };
    action.diagnostics = [...context.diagnostics];
    action.isPreferred = true;
    return [action];
  }
}
