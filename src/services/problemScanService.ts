import * as ts from 'typescript';
import * as vscode from 'vscode';
import { getConfig } from '../config';
import { getScriptKind } from '../languageSupport';
import { ScanProblem, ScanSummary } from '../types';
import { expandBraceGlob, globToRegExp, isNaturalLanguage, stripQuotes } from '../utils';
import { scanVueDocument } from '../vueSupport';
import { LocaleService } from './localeService';

interface UsedKeyLocation {
  key: string;
  uri: vscode.Uri;
  range: vscode.Range;
}

interface DocumentScanResult {
  hardcodedProblems: ScanProblem[];
  usedKeys: UsedKeyLocation[];
}

interface CachedFileScan {
  mtime: number;
  size: number;
  functionName: string;
  result: DocumentScanResult;
}

export class ProblemScanService {
  private lastScanSummary: ScanSummary = {
    workspaceRoots: [],
    includePatterns: [],
    excludePatterns: [],
    scannedFiles: [],
    skippedFiles: [],
    unmatchedFiles: [],
    cacheHits: 0,
    cacheMisses: 0
  };
  private readonly fileScanCache = new Map<string, CachedFileScan>();

  constructor(private readonly localeService: LocaleService) {}

  async scanWorkspace(resource?: vscode.Uri): Promise<ScanProblem[]> {
    const config = getConfig(resource);
    const targetFolder = this.getTargetWorkspaceFolder(resource);
    const workspaceRoots = targetFolder ? [targetFolder.uri.fsPath] : [];
    const locales = await this.localeService.readAllLocales(resource);
    const defaultLocale = locales.get(config.defaultLanguage) ?? {};
    const usedKeys = new Map<string, { uri: vscode.Uri; range: vscode.Range }[]>();
    const problems: ScanProblem[] = [];
    const includePatterns = config.include.flatMap((pattern) => expandBraceGlob(pattern));
    const excludePatterns = config.exclude.flatMap((pattern) => expandBraceGlob(pattern));
    const includeMatchers = includePatterns.map((pattern) => globToRegExp(pattern));
    const excludeMatchers = excludePatterns.map((pattern) => globToRegExp(pattern));
    const folderUris = targetFolder ? [targetFolder.uri] : [];
    const scannedFiles: string[] = [];
    const skippedFiles: string[] = [];
    const unmatchedFiles: string[] = [];
    const scannedUris: vscode.Uri[] = [];
    let cacheHits = 0;
    let cacheMisses = 0;

    if (folderUris.length === 0) {
      const activeDocument =
        resource && vscode.window.activeTextEditor?.document.uri.toString() === resource.toString()
          ? vscode.window.activeTextEditor.document
          : vscode.window.activeTextEditor?.document;
      if (activeDocument) {
        const relativePath = activeDocument.fileName.replace(/\\/g, '/');
        scannedFiles.push(relativePath);
        scannedUris.push(activeDocument.uri);
        const documentResult = this.scanDocument(activeDocument, config.functionName);
        problems.push(...documentResult.hardcodedProblems);
        this.applyUsedKeys(documentResult.usedKeys, usedKeys);
        this.appendMissingKeyProblems(documentResult.usedKeys, defaultLocale, problems);
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
        let stat: vscode.FileStat;
        try {
          stat = await vscode.workspace.fs.stat(file);
        } catch {
          continue;
        }
        const cacheKey = file.toString();
        const cached = this.fileScanCache.get(cacheKey);
        let documentResult: DocumentScanResult;

        if (
          cached &&
          cached.mtime === stat.mtime &&
          cached.size === stat.size &&
          cached.functionName === config.functionName
        ) {
          documentResult = cached.result;
          cacheHits += 1;
        } else {
          const document = await vscode.workspace.openTextDocument(file);
          documentResult = this.scanDocument(document, config.functionName);
          this.fileScanCache.set(cacheKey, {
            mtime: stat.mtime,
            size: stat.size,
            functionName: config.functionName,
            result: documentResult
          });
          cacheMisses += 1;
        }

        problems.push(...documentResult.hardcodedProblems);
        this.applyUsedKeys(documentResult.usedKeys, usedKeys);
        this.appendMissingKeyProblems(documentResult.usedKeys, defaultLocale, problems);
      }

      // Prevent unbounded growth on large repos or frequent config changes.
      if (this.fileScanCache.size > 5000) {
        this.fileScanCache.clear();
      }
    }

    this.lastScanSummary = {
      includePatterns,
      workspaceRoots,
      excludePatterns,
      scannedFiles,
      skippedFiles,
      unmatchedFiles,
      cacheHits,
      cacheMisses
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
    const result = this.scanDocument(document, config.functionName);
    const problems: ScanProblem[] = [...result.hardcodedProblems];
    const relativePath = vscode.workspace.asRelativePath(document.uri, false).replace(/\\/g, '/');

    this.applyUsedKeys(result.usedKeys, usedKeys);
    this.appendMissingKeyProblems(result.usedKeys, defaultLocale, problems);
    this.lastScanSummary = {
      workspaceRoots: (vscode.workspace.workspaceFolders ?? []).map((folder) => folder.uri.fsPath),
      includePatterns: ['<current-file>'],
      excludePatterns: [],
      scannedFiles: [relativePath],
      skippedFiles: [],
      unmatchedFiles: [],
      cacheHits: 0,
      cacheMisses: 1
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

  private scanDocument(document: vscode.TextDocument, functionName: string): DocumentScanResult {
    const hardcodedProblems: ScanProblem[] = [];
    const usedKeys: UsedKeyLocation[] = [];

    if (document.fileName.endsWith('.vue')) {
      const vueUsedKeys = new Map<string, { uri: vscode.Uri; range: vscode.Range }[]>();
      scanVueDocument(document, functionName, {}, vueUsedKeys, hardcodedProblems);
      for (const [key, entries] of vueUsedKeys.entries()) {
        for (const entry of entries) {
          usedKeys.push({ key, uri: entry.uri, range: entry.range });
        }
      }
      // Vue scanning currently writes both hardcoded and missing-key directly, so we keep only hardcoded entries.
      const cleaned = hardcodedProblems.filter((problem) => problem.type === 'hardcoded-text');
      return { hardcodedProblems: cleaned, usedKeys };
    }

    const scriptKind = getScriptKind(document);
    if (scriptKind === ts.ScriptKind.Unknown) {
      return { hardcodedProblems, usedKeys };
    }

    const sourceFile = ts.createSourceFile(
      document.fileName,
      document.getText(),
      ts.ScriptTarget.Latest,
      true,
      scriptKind
    );
    const visit = (node: ts.Node): void => {
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === functionName) {
        const firstArg = node.arguments[0];
        if (firstArg && ts.isStringLiteral(firstArg)) {
          const key = firstArg.text;
          const range = new vscode.Range(document.positionAt(firstArg.getStart(sourceFile)), document.positionAt(firstArg.getEnd()));
          usedKeys.push({ key, uri: document.uri, range });
        }
      }

      if (
        (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) &&
        this.isHardcodedCandidate(node, functionName)
      ) {
        const text = stripQuotes(node.getText(sourceFile));
        if (isNaturalLanguage(text)) {
          hardcodedProblems.push({
            type: 'hardcoded-text',
            message: `Hardcoded text: ${text}`,
            severity: vscode.DiagnosticSeverity.Warning,
            uri: document.uri,
            range: new vscode.Range(document.positionAt(node.getStart(sourceFile)), document.positionAt(node.getEnd()))
          });
        }
      }

      if (ts.isJsxText(node) && isNaturalLanguage(node.getText(sourceFile).trim())) {
        hardcodedProblems.push({
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
    return { hardcodedProblems, usedKeys };
  }

  private applyUsedKeys(
    locations: UsedKeyLocation[],
    usedKeys: Map<string, { uri: vscode.Uri; range: vscode.Range }[]>
  ): void {
    for (const location of locations) {
      const entries = usedKeys.get(location.key) ?? [];
      entries.push({ uri: location.uri, range: location.range });
      usedKeys.set(location.key, entries);
    }
  }

  private appendMissingKeyProblems(
    locations: UsedKeyLocation[],
    defaultLocale: Record<string, string>,
    problems: ScanProblem[]
  ): void {
    for (const location of locations) {
      if (location.key in defaultLocale) {
        continue;
      }
      problems.push({
        type: 'missing-key',
        message: `Missing locale key: ${location.key}`,
        severity: vscode.DiagnosticSeverity.Error,
        uri: location.uri,
        range: location.range,
        key: location.key
      });
    }
  }

  private getTargetWorkspaceFolder(resource?: vscode.Uri): vscode.WorkspaceFolder | undefined {
    if (resource) {
      return vscode.workspace.getWorkspaceFolder(resource);
    }
    const activeResource = vscode.window.activeTextEditor?.document.uri;
    if (activeResource) {
      const activeFolder = vscode.workspace.getWorkspaceFolder(activeResource);
      if (activeFolder) {
        return activeFolder;
      }
    }
    return vscode.workspace.workspaceFolders?.[0];
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
