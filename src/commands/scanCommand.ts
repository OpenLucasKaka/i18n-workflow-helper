import * as vscode from 'vscode';
import { ProblemScanService } from '../services/problemScanService';
import { ProblemTreeProvider } from '../views/problemTreeProvider';

export function createScanCommand(
  problemScanService: ProblemScanService,
  treeProvider: ProblemTreeProvider
): () => Promise<void> {
  return async () => {
    const problems = await problemScanService.scanWorkspace();
    treeProvider.setProblems(problems);
    void vscode.window.showInformationMessage(`i18n scan complete: ${problems.length} problem(s).`);
  };
}
