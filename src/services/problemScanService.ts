import * as ts from 'typescript';
import * as vscode from 'vscode';
import { getConfig } from '../config';
import { getScriptKind } from '../languageSupport';
import { ScanProblem, ScanSummary } from '../types';
import { expandBraceGlob, globToRegExp, isNaturalLanguage, stripQuotes } from '../utils';
import { scanVueDocument } from '../vueSupport';
import { LocaleService } from './localeService';

export class ProblemScanService {
  private lastScanSummary: ScanSummary = {
    workspaceRoots: [],
    includePatterns: [],
    excludePatterns: [],
    scannedFiles: [],
    skippedFiles: [],
    unmatchedFiles: []
  };

  constructor(private readonly localeService: LocaleService) {}

  async scanWorkspace(): Promise<ScanProblem[]> {
    const config = getConfig();
    const workspaceRoots = (vscode.workspace.workspaceFolders ?? []).map((folder) => folder.uri.fsPath);
    const locales = await this.localeService.readAllLocales();
    const defaultLocale = locales.get(config.defaultLanguage) ?? {};
    const usedKeys = new Map<string, { uri: vscode.Uri; range: vscode.Range }[]>();
    const problems: ScanProblem[] = [];
    const includePatterns = config.include.flatMap((pattern) => expandBraceGlob(pattern));
    const excludePatterns = config.exclude.flatMap((pattern) => expandBraceGlob(pattern));
    const includeMatchers = includePatterns.map((pattern) => globToRegExp(pattern));
    const excludeMatchers = excludePatterns.map((pattern) => globToRegExp(pattern));
    const folderUris = vscode.workspace.workspaceFolders?.map((folder) => folder.uri) ?? [];
    const scannedFiles: string[] = [];
    const skippedFiles: string[] = [];
    const unmatchedFiles: string[] = [];
    const scannedUris: vscode.Uri[] = [];

    if (folderUris.length === 0) {
      const activeDocument = vscode.window.activeTextEditor?.document;
      if (activeDocument) {
        const relativePath = activeDocument.fileName.replace(/\\/g, '/');
        scannedFiles.push(relativePath);
        scannedUris.push(activeDocument.uri);
        this.scanDocument(activeDocument, problems, usedKeys, defaultLocale);
      }
    } else {
      for (const folderUri of folderUris) {
        await this.collectFiles(
          folderUri,
          folderUri,
          includeMatchers,
          excludeMatchers,
          scannedUris,
          scannedFiles,
          skippedFiles,
          unmatchedFiles
        );
      }
      for (const file of scannedUris) {
        const document = await vscode.workspace.openTextDocument(file);
        this.scanDocument(document, problems, usedKeys, defaultLocale);
      }
    }

    this.lastScanSummary = {
      includePatterns,
      workspaceRoots,
      excludePatterns,
      scannedFiles,
      skippedFiles,
      unmatchedFiles
    };

    for (const [key, value] of Object.entries(defaultLocale)) {
      if (!usedKeys.has(key)) {
        problems.push({
          type: 'unused-key',
          message: `Unused key: ${key}`,
          severity: vscode.DiagnosticSeverity.Information,
          key
        });
      }
      void value;
    }

    for (const language of config.languages) {
      if (language === config.defaultLanguage) {
        continue;
      }
      const locale = locales.get(language) ?? {};
      for (const key of Object.keys(defaultLocale)) {
        if (!(key in locale)) {
          problems.push({
            type: 'locale-mismatch',
            message: `Missing key in ${language}: ${key}`,
            severity: vscode.DiagnosticSeverity.Warning,
            key,
            language
          });
        }
      }
      for (const key of Object.keys(locale)) {
        if (!(key in defaultLocale)) {
          problems.push({
            type: 'locale-mismatch',
            message: `Extra key in ${language}: ${key}`,
            severity: vscode.DiagnosticSeverity.Information,
            key,
            language
          });
        }
      }
    }

    return problems;
  }

  async scanDocumentInEditor(document: vscode.TextDocument): Promise<ScanProblem[]> {
    const config = getConfig(document.uri);
    const locales = await this.localeService.readAllLocales(document.uri);
    const defaultLocale = locales.get(config.defaultLanguage) ?? {};
    const usedKeys = new Map<string, { uri: vscode.Uri; range: vscode.Range }[]>();
    const problems: ScanProblem[] = [];
    const relativePath = vscode.workspace.asRelativePath(document.uri, false).replace(/\\/g, '/');

    this.scanDocument(document, problems, usedKeys, defaultLocale);
    this.lastScanSummary = {
      workspaceRoots: (vscode.workspace.workspaceFolders ?? []).map((folder) => folder.uri.fsPath),
      includePatterns: ['<current-file>'],
      excludePatterns: [],
      scannedFiles: [relativePath],
      skippedFiles: [],
      unmatchedFiles: []
    };

    return problems;
  }

  getLastScanSummary(): ScanSummary {
    return this.lastScanSummary;
  }

  private async collectFiles(
    rootUri: vscode.Uri,
    currentUri: vscode.Uri,
    includeMatchers: RegExp[],
    excludeMatchers: RegExp[],
    scannedUris: vscode.Uri[],
    scannedFiles: string[],
    skippedFiles: string[],
    unmatchedFiles: string[]
  ): Promise<void> {
    const entries = await vscode.workspace.fs.readDirectory(currentUri);
    for (const [name, type] of entries) {
      const childUri = vscode.Uri.joinPath(currentUri, name);
      const relativePath = this.toWorkspaceRelativePath(rootUri, childUri);

      if (this.matchesAny(excludeMatchers, relativePath)) {
        skippedFiles.push(relativePath);
        continue;
      }

      if (type === vscode.FileType.Directory) {
        await this.collectFiles(
          rootUri,
          childUri,
          includeMatchers,
          excludeMatchers,
          scannedUris,
          scannedFiles,
          skippedFiles,
          unmatchedFiles
        );
        continue;
      }

      if (type === vscode.FileType.File && this.matchesAny(includeMatchers, relativePath)) {
        scannedUris.push(childUri);
        scannedFiles.push(relativePath);
      } else if (type === vscode.FileType.File) {
        unmatchedFiles.push(relativePath);
      }
    }
  }

  private toWorkspaceRelativePath(rootUri: vscode.Uri, childUri: vscode.Uri): string {
    const rootPath = rootUri.path.endsWith('/') ? rootUri.path : `${rootUri.path}/`;
    const childPath = childUri.path;
    if (childPath.startsWith(rootPath)) {
      return childPath.slice(rootPath.length).replace(/\\/g, '/');
    }
    return vscode.workspace.asRelativePath(childUri, false).replace(/\\/g, '/');
  }

  private matchesAny(matchers: RegExp[], relativePath: string): boolean {
    if (matchers.some((matcher) => matcher.test(relativePath))) {
      return true;
    }

    const segments = relativePath.split('/');
    for (let index = 1; index < segments.length; index += 1) {
      const suffix = segments.slice(index).join('/');
      if (matchers.some((matcher) => matcher.test(suffix))) {
        return true;
      }
    }

    return false;
  }

  private scanDocument(
    document: vscode.TextDocument,
    problems: ScanProblem[],
    usedKeys: Map<string, { uri: vscode.Uri; range: vscode.Range }[]>,
    defaultLocale: Record<string, string>
  ): void {
    if (document.fileName.endsWith('.vue')) {
      scanVueDocument(document, getConfig(document.uri).functionName, defaultLocale, usedKeys, problems);
      return;
    }

    const scriptKind = getScriptKind(document);
    if (scriptKind === ts.ScriptKind.Unknown) {
      return;
    }

    const sourceFile = ts.createSourceFile(
      document.fileName,
      document.getText(),
      ts.ScriptTarget.Latest,
      true,
      scriptKind
    );
    const functionName = getConfig(document.uri).functionName;

    const visit = (node: ts.Node): void => {
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === functionName) {
        const firstArg = node.arguments[0];
        if (firstArg && ts.isStringLiteral(firstArg)) {
          const key = firstArg.text;
          const range = new vscode.Range(document.positionAt(firstArg.getStart(sourceFile)), document.positionAt(firstArg.getEnd()));
          const entries = usedKeys.get(key) ?? [];
          entries.push({ uri: document.uri, range });
          usedKeys.set(key, entries);
          if (!(key in defaultLocale)) {
            problems.push({
              type: 'missing-key',
              message: `Missing locale key: ${key}`,
              severity: vscode.DiagnosticSeverity.Error,
              uri: document.uri,
              range,
              key
            });
          }
        }
      }

      if (
        (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) &&
        this.isHardcodedCandidate(node, functionName)
      ) {
        const text = stripQuotes(node.getText(sourceFile));
        if (isNaturalLanguage(text)) {
          problems.push({
            type: 'hardcoded-text',
            message: `Hardcoded text: ${text}`,
            severity: vscode.DiagnosticSeverity.Warning,
            uri: document.uri,
            range: new vscode.Range(document.positionAt(node.getStart(sourceFile)), document.positionAt(node.getEnd()))
          });
        }
      }

      if (ts.isJsxText(node) && isNaturalLanguage(node.getText(sourceFile).trim())) {
        problems.push({
          type: 'hardcoded-text',
          message: `Hardcoded text: ${node.getText(sourceFile).trim()}`,
          severity: vscode.DiagnosticSeverity.Warning,
          uri: document.uri,
          range: new vscode.Range(document.positionAt(node.getStart(sourceFile)), document.positionAt(node.getEnd()))
        });
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
  }

  private isHardcodedCandidate(
    node: ts.StringLiteral | ts.NoSubstitutionTemplateLiteral,
    functionName: string
  ): boolean {
    const parent = node.parent;
    const ignoredPropertyKeys = new Set([
      'id',
      'key',
      'className',
      'path',
      'url',
      'href',
      'testId',
      'name',
      'type',
      'variant',
      'icon',
      'size',
      'status',
      'method',
      'mode',
      'to',
      'from'
    ]);
    const ignoredCallNames = new Set([
      'require',
      'console.log',
      'console.info',
      'console.warn',
      'console.error',
      'logger.debug',
      'logger.info',
      'logger.warn',
      'logger.error',
      'debug',
      'assert',
      'invariant'
    ]);

    if (ts.isImportDeclaration(parent) || ts.isExportDeclaration(parent)) {
      return false;
    }
    if (ts.isTypeNode(parent) || ts.isLiteralTypeNode(parent)) {
      return false;
    }
    if (ts.isJsxAttribute(parent)) {
      const attrName = parent.name.getText();
      const ignoredNames = new Set([
        'className',
        'id',
        'key',
        'role',
        'href',
        'src',
        'alt',
        'type',
        'data-testid',
        'data-test',
        'data-cy',
        'aria-label',
        'aria-labelledby',
        'aria-describedby'
      ]);
      if (ignoredNames.has(attrName)) {
        return false;
      }
    }
    if (ts.isPropertyAssignment(parent) && ts.isIdentifier(parent.name)) {
      if (ignoredPropertyKeys.has(parent.name.text)) {
        return false;
      }
    }
    if (ts.isShorthandPropertyAssignment(parent) || ts.isPropertySignature(parent)) {
      return false;
    }
    if (
      ts.isCallExpression(parent) &&
      ts.isIdentifier(parent.expression) &&
      parent.expression.text === functionName
    ) {
      return false;
    }
    const callExpression = ts.isCallExpression(parent)
      ? parent
      : ts.isNewExpression(parent)
        ? parent
        : ts.isPropertyAccessExpression(parent) && ts.isCallExpression(parent.parent)
          ? parent.parent
          : undefined;
    if (callExpression) {
      const callName = this.getCallName(callExpression.expression);
      if (callName && ignoredCallNames.has(callName)) {
        return false;
      }
      if (ts.isNewExpression(callExpression) && callName && ['Error', 'TypeError', 'RangeError'].includes(callName)) {
        return false;
      }
    }
    if (ts.isVariableDeclaration(parent) && ts.isIdentifier(parent.name)) {
      const variableName = parent.name.text;
      if (/(path|url|href|route|variant|type|class|icon|mode|status|test)/i.test(variableName)) {
        return false;
      }
    }
    if (ts.isBinaryExpression(parent) && parent.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
      return false;
    }
    return true;
  }

  private getCallName(expression: ts.Expression): string | undefined {
    if (ts.isIdentifier(expression)) {
      return expression.text;
    }
    if (ts.isPropertyAccessExpression(expression)) {
      const left = this.getCallName(expression.expression);
      return left ? `${left}.${expression.name.text}` : expression.name.text;
    }
    return undefined;
  }
}
