import * as vscode from 'vscode';
import { ProblemScanService } from '../services/problemScanService';
import { ProblemTreeProvider } from '../views/problemTreeProvider';

export function createScanCurrentFileCommand(
  problemScanService: ProblemScanService,
  treeProvider: ProblemTreeProvider,
  outputChannel: vscode.OutputChannel
): () => Promise<void> {
  return async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      void vscode.window.showWarningMessage('No active editor.');
      return;
    }

    const problems = await problemScanService.scanDocumentInEditor(editor.document);
    const summary = problemScanService.getLastScanSummary();
    treeProvider.setProblems(problems);

    outputChannel.clear();
    outputChannel.appendLine('I18n Workflow current file scan summary');
    outputChannel.appendLine(`Workspace roots: ${summary.workspaceRoots.join(', ') || '(none)'}`);
    outputChannel.appendLine(`Scanned file: ${summary.scannedFiles[0] ?? '(none)'}`);
    outputChannel.appendLine(`Problems: ${problems.length}`);

    void vscode.window.showInformationMessage(
      `i18n current file scan complete: ${problems.length} problem(s).`,
      'Open Scan Log'
    ).then((action) => {
      if (action === 'Open Scan Log') {
        outputChannel.show(true);
      }
    });
  };
}
