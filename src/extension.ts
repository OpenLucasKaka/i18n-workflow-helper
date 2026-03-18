import * as vscode from 'vscode';
import { getConfig } from './config';
import { createExtractCommand } from './commands/extractCommand';
import { createExtractAtRangeCommand } from './commands/extractAtRangeCommand';
import { createApplyPendingImportCommand } from './commands/applyPendingImportCommand';
import { createDiscardPendingImportCommand } from './commands/discardPendingImportCommand';
import { createExportLocalesCommand } from './commands/exportLocalesCommand';
import { createImportLocaleCommand } from './commands/importLocaleCommand';
import { createScanCommand } from './commands/scanCommand';
import { createScanCurrentFileCommand } from './commands/scanCurrentFileCommand';
import { createSetDefaultLanguageCommand } from './commands/setDefaultLanguageCommand';
import { createSetLocaleDirectoryCommand } from './commands/setLocaleDirectoryCommand';
import { ImportPreviewContentProvider } from './providers/importPreviewContentProvider';
import { I18nCodeActionProvider } from './providers/i18nCodeActionProvider';
import { CodeReplaceService } from './services/codeReplaceService';
import { LanguageDetectionService } from './services/languageDetectionService';
import { LocaleService } from './services/localeService';
import { ProblemScanService } from './services/problemScanService';
import { ScanProblem } from './types';
import { ProblemTreeProvider } from './views/problemTreeProvider';
import { LocaleFileSummary } from './types';
import { PendingImportSession } from './types';

export function activate(context: vscode.ExtensionContext): void {
  try {
    const localeService = new LocaleService();
    const codeReplaceService = new CodeReplaceService();
    const languageDetectionService = new LanguageDetectionService();
    const problemScanService = new ProblemScanService(localeService);
    const treeProvider = new ProblemTreeProvider();
    const previewProvider = new ImportPreviewContentProvider();
    const pendingImport: { current?: PendingImportSession } = {};
    const diagnostics = vscode.languages.createDiagnosticCollection('i18nWorkflow');
    const outputChannel = vscode.window.createOutputChannel('I18n Workflow');
    outputChannel.appendLine('activate: start');
    const refreshWorkspaceView = async (resource?: vscode.Uri): Promise<void> => {
      const problems = await problemScanService.scanWorkspace();
      updateDiagnostics(diagnostics, problems);
      treeProvider.setProblems(problems);
      const localeDirectory = localeService.getLocaleDirectorySummary(resource);
      treeProvider.setLocaleDirectory(localeDirectory);
      treeProvider.setLocaleFiles(await localeService.getLocaleFileSummaries(resource));
      if (!localeDirectory.exists) {
        void vscode.window.showWarningMessage(
          `Locale directory "${localeDirectory.relativePath}" does not exist in the current workspace.`
        );
      }
    };
    const safeRefreshWorkspaceView = async (resource?: vscode.Uri): Promise<void> => {
      try {
        await refreshWorkspaceView(resource);
        outputChannel.appendLine('refreshWorkspaceView: success');
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        outputChannel.appendLine(`Refresh workspace view failed: ${message}`);
        void vscode.window.showErrorMessage(`I18n Workflow refresh failed: ${message}`);
      }
    };

    context.subscriptions.push(
      diagnostics,
      outputChannel,
      vscode.workspace.registerTextDocumentContentProvider('i18n-preview', previewProvider),
      vscode.window.registerTreeDataProvider('i18nWorkflow.workspace', treeProvider),
      vscode.languages.registerCodeActionsProvider(
        [
          { language: 'typescriptreact' },
          { language: 'javascriptreact' },
          { language: 'typescript' },
          { language: 'javascript' },
          { language: 'vue' }
        ],
        new I18nCodeActionProvider(),
        { providedCodeActionKinds: I18nCodeActionProvider.providedCodeActionKinds }
      ),
      vscode.commands.registerCommand(
        'i18nWorkflow.extractText',
        async () => {
          try {
            const command = createExtractCommand(localeService, codeReplaceService, languageDetectionService);
            const resource = vscode.window.activeTextEditor?.document.uri;
            await command();
            await safeRefreshWorkspaceView(resource);
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            outputChannel.appendLine(`Extract selected text failed: ${message}`);
            void vscode.window.showErrorMessage(`Extract selected text failed: ${message}`);
          }
        }
      ),
      vscode.commands.registerCommand('i18nWorkflow.extractHardcodedTextInCurrentFile', async () => {
        outputChannel.appendLine('Extract hardcoded text in current file is temporarily disabled.');
        void vscode.window.showWarningMessage(
          'i18n: Extract Hardcoded Text In Current File is temporarily disabled while multi-workspace issues are fixed.'
        );
      }),
      vscode.commands.registerCommand(
        'i18nWorkflow.extractTextAtRange',
        async (uri: vscode.Uri, range: vscode.Range) => {
          try {
            const command = createExtractAtRangeCommand();
            await command(uri, range);
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            outputChannel.appendLine(`Extract text at range failed: ${message}`);
            void vscode.window.showErrorMessage(`Extract text at range failed: ${message}`);
          }
        }
      ),
      vscode.commands.registerCommand('i18nWorkflow.exportLocales', createExportLocalesCommand(localeService)),
      vscode.commands.registerCommand(
        'i18nWorkflow.importLocale',
        createImportLocaleCommand(localeService, previewProvider, pendingImport)
      ),
      vscode.commands.registerCommand(
        'i18nWorkflow.applyPendingImport',
        createApplyPendingImportCommand(localeService, previewProvider, pendingImport)
      ),
      vscode.commands.registerCommand(
        'i18nWorkflow.discardPendingImport',
        createDiscardPendingImportCommand(previewProvider, pendingImport)
      ),
      vscode.commands.registerCommand('i18nWorkflow.setDefaultLanguage', createSetDefaultLanguageCommand(safeRefreshWorkspaceView)),
      vscode.commands.registerCommand('i18nWorkflow.setLocaleDirectory', createSetLocaleDirectoryCommand(safeRefreshWorkspaceView)),
      vscode.commands.registerCommand('i18nWorkflow.scanWorkspace', async () => {
        const command = createScanCommand(problemScanService, treeProvider, outputChannel);
        try {
          const resource = vscode.window.activeTextEditor?.document.uri;
          await command();
          await safeRefreshWorkspaceView(resource);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          outputChannel.appendLine(`Scan workspace failed: ${message}`);
          void vscode.window.showErrorMessage(`Scan workspace failed: ${message}`);
        }
      }),
      vscode.commands.registerCommand(
        'i18nWorkflow.scanCurrentFile',
        async () => {
          try {
            const command = createScanCurrentFileCommand(problemScanService, treeProvider, outputChannel);
            await command();
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            outputChannel.appendLine(`Scan current file failed: ${message}`);
            void vscode.window.showErrorMessage(`Scan current file failed: ${message}`);
          }
        }
      ),
      vscode.commands.registerCommand('i18nWorkflow.refreshProblems', safeRefreshWorkspaceView),
      vscode.commands.registerCommand('i18nWorkflow.openProblem', openProblem),
      vscode.commands.registerCommand('i18nWorkflow.openLocaleFile', openLocaleFile)
    );

    const watcher = createLocaleWatcher(localeService);
    if (watcher) {
      context.subscriptions.push(watcher);
    }

    void safeRefreshWorkspaceView(vscode.window.activeTextEditor?.document.uri);
    outputChannel.appendLine('activate: complete');
  } catch (error) {
    const message = error instanceof Error ? error.stack ?? error.message : String(error);
    void vscode.window.showErrorMessage(`I18n Workflow activation failed: ${message}`);
    console.error('I18n Workflow activation failed:', error);
  }
}

export function deactivate(): void {}

function updateDiagnostics(collection: vscode.DiagnosticCollection, problems: ScanProblem[]): void {
  collection.clear();
  const grouped = new Map<string, { uri: vscode.Uri; diagnostics: vscode.Diagnostic[] }>();

  for (const problem of problems) {
    if (!problem.uri || !problem.range) {
      continue;
    }
    const entry = grouped.get(problem.uri.toString()) ?? { uri: problem.uri, diagnostics: [] };
    const diagnostic = new vscode.Diagnostic(problem.range, problem.message, problem.severity);
    diagnostic.source = 'i18nWorkflow';
    diagnostic.code = problem.type;
    entry.diagnostics.push(diagnostic);
    grouped.set(problem.uri.toString(), entry);
  }

  for (const entry of grouped.values()) {
    collection.set(entry.uri, entry.diagnostics);
  }
}

async function openProblem(problem: ScanProblem): Promise<void> {
  if (!problem.uri || !problem.range) {
    return;
  }
  const document = await vscode.workspace.openTextDocument(problem.uri);
  const editor = await vscode.window.showTextDocument(document);
  editor.selection = new vscode.Selection(problem.range.start, problem.range.end);
  editor.revealRange(problem.range, vscode.TextEditorRevealType.InCenter);
}

async function openLocaleFile(file: LocaleFileSummary): Promise<void> {
  const document = await vscode.workspace.openTextDocument(file.uri);
  await vscode.window.showTextDocument(document);
}

function createLocaleWatcher(localeService: LocaleService): vscode.FileSystemWatcher | undefined {
  const folder = vscode.workspace.workspaceFolders?.[0];
  if (!folder) {
    return;
  }
  const config = getConfig();
  const defaultUri = localeService.getLocaleFileUri(config.defaultLanguage);
  const relativePath = vscode.workspace.asRelativePath(defaultUri, false);
  const watcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(folder, relativePath));
  const sync = async (): Promise<void> => {
    try {
      await localeService.syncLocaleStructure();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      void vscode.window.showErrorMessage(`Failed to sync locale structure: ${message}`);
    }
  };
  watcher.onDidChange(sync);
  watcher.onDidCreate(sync);
  return watcher;
}
