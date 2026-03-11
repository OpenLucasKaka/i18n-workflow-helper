import * as vscode from 'vscode';

export function createExtractAtRangeCommand(): (uri: vscode.Uri, range: vscode.Range) => Promise<void> {
  return async (uri: vscode.Uri, range: vscode.Range) => {
    const document = await vscode.workspace.openTextDocument(uri);
    const editor = await vscode.window.showTextDocument(document);
    editor.selection = new vscode.Selection(range.start, range.end);
    editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
    await vscode.commands.executeCommand('i18nWorkflow.extractText');
  };
}
