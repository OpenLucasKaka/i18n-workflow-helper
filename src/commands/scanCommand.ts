import * as vscode from 'vscode';
import { ProblemScanService } from '../services/problemScanService';
import { ProblemTreeProvider } from '../views/problemTreeProvider';

export function createScanCommand(
  problemScanService: ProblemScanService,
  treeProvider: ProblemTreeProvider,
  outputChannel: vscode.OutputChannel,
  getResource?: () => vscode.Uri | undefined
): () => Promise<void> {
  return async () => {
    const resource = getResource?.();
    const problems = await problemScanService.scanWorkspace(resource);
    const summary = problemScanService.getLastScanSummary();
    treeProvider.setProblems(problems);
    outputChannel.clear();
    outputChannel.appendLine('I18n Workflow scan summary');
    outputChannel.appendLine(`Workspace roots: ${summary.workspaceRoots.join(', ') || '(none)'}`);
    outputChannel.appendLine(`Include patterns: ${summary.includePatterns.join(', ') || '(none)'}`);
    outputChannel.appendLine(`Exclude patterns: ${summary.excludePatterns.join(', ') || '(none)'}`);
    outputChannel.appendLine(`Scanned files: ${summary.scannedFiles.length}`);
    for (const file of summary.scannedFiles) {
      outputChannel.appendLine(`  scan  ${file}`);
    }
    outputChannel.appendLine(`Skipped files: ${summary.skippedFiles.length}`);
    for (const file of summary.skippedFiles) {
      outputChannel.appendLine(`  skip  ${file}`);
    }
    outputChannel.appendLine(`Unmatched files: ${summary.unmatchedFiles.length}`);
    for (const file of summary.unmatchedFiles.slice(0, 50)) {
      outputChannel.appendLine(`  miss  ${file}`);
    }
    if (summary.unmatchedFiles.length > 50) {
      outputChannel.appendLine(`  ... ${summary.unmatchedFiles.length - 50} more unmatched file(s)`);
    }
    outputChannel.appendLine(`Cache hits: ${summary.cacheHits ?? 0}`);
    outputChannel.appendLine(`Cache misses: ${summary.cacheMisses ?? 0}`);
    outputChannel.appendLine(`Problems: ${problems.length}`);
    void vscode.window.showInformationMessage(
      `i18n scan complete: ${problems.length} problem(s), scanned ${summary.scannedFiles.length} file(s).`,
      'Open Scan Log'
    ).then((action) => {
      if (action === 'Open Scan Log') {
        outputChannel.show(true);
      }
    });
  };
}
