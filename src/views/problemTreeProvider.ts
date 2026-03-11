import * as vscode from 'vscode';
import { LocaleDirectorySummary, LocaleFileSummary, ScanProblem } from '../types';

type TreeNode = SectionItem | ProblemItem | LocaleItem | LocaleDirectoryItem;

class SectionItem extends vscode.TreeItem {
  constructor(
    public readonly section: 'problems' | 'locales',
    label: string,
    description: string
  ) {
    super(label, vscode.TreeItemCollapsibleState.Expanded);
    this.description = description;
    this.contextValue = `section:${section}`;
  }
}

class ProblemItem extends vscode.TreeItem {
  constructor(public readonly problem: ScanProblem) {
    super(problem.message, vscode.TreeItemCollapsibleState.None);
    this.description = problem.uri ? vscode.workspace.asRelativePath(problem.uri) : problem.language ?? problem.key;
    this.command = {
      command: 'i18nWorkflow.openProblem',
      title: 'Open Problem',
      arguments: [problem]
    };
    this.contextValue = problem.type;
  }
}

class LocaleItem extends vscode.TreeItem {
  constructor(public readonly file: LocaleFileSummary) {
    super(file.language, vscode.TreeItemCollapsibleState.None);
    this.description = `${file.keyCount} keys`;
    this.tooltip = file.uri.fsPath;
    this.command = {
      command: 'i18nWorkflow.openLocaleFile',
      title: 'Open Locale File',
      arguments: [file]
    };
    this.contextValue = 'locale-file';
    this.resourceUri = file.uri;
  }
}

class LocaleDirectoryItem extends vscode.TreeItem {
  constructor(public readonly summary: LocaleDirectorySummary) {
    super('Directory', vscode.TreeItemCollapsibleState.None);
    this.description = summary.relativePath;
    this.tooltip = `${summary.absolutePath}${summary.exists ? '' : ' (missing)'}`;
    this.contextValue = 'locale-directory';
  }
}

export class ProblemTreeProvider implements vscode.TreeDataProvider<TreeNode> {
  private readonly emitter = new vscode.EventEmitter<TreeNode | undefined | void>();
  readonly onDidChangeTreeData = this.emitter.event;
  private problems: ScanProblem[] = [];
  private localeFiles: LocaleFileSummary[] = [];
  private localeDirectory?: LocaleDirectorySummary;

  setProblems(problems: ScanProblem[]): void {
    this.problems = problems;
    this.emitter.fire();
  }

  setLocaleFiles(localeFiles: LocaleFileSummary[]): void {
    this.localeFiles = localeFiles;
    this.emitter.fire();
  }

  setLocaleDirectory(localeDirectory: LocaleDirectorySummary): void {
    this.localeDirectory = localeDirectory;
    this.emitter.fire();
  }

  getTreeItem(element: TreeNode): vscode.TreeItem {
    return element;
  }

  getChildren(element?: TreeNode): TreeNode[] {
    if (!element) {
      return [
        new SectionItem('problems', 'Problems', `${this.problems.length}`),
        new SectionItem('locales', 'Locale Files', `${this.localeFiles.length}`)
      ];
    }

    if (element instanceof SectionItem && element.section === 'problems') {
      return this.problems.map((problem) => new ProblemItem(problem));
    }

    if (element instanceof SectionItem && element.section === 'locales') {
      const nodes: TreeNode[] = [];
      if (this.localeDirectory) {
        nodes.push(new LocaleDirectoryItem(this.localeDirectory));
      }
      nodes.push(...this.localeFiles.map((file) => new LocaleItem(file)));
      return nodes;
    }

    return [];
  }
}
