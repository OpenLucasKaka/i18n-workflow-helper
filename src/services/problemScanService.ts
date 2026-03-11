import * as ts from 'typescript';
import * as vscode from 'vscode';
import { getConfig } from '../config';
import { ScanProblem } from '../types';
import { isNaturalLanguage, stripQuotes } from '../utils';
import { LocaleService } from './localeService';

export class ProblemScanService {
  constructor(private readonly localeService: LocaleService) {}

  async scanWorkspace(): Promise<ScanProblem[]> {
    const config = getConfig();
    const locales = await this.localeService.readAllLocales();
    const defaultLocale = locales.get(config.defaultLanguage) ?? {};
    const usedKeys = new Map<string, { uri: vscode.Uri; range: vscode.Range }[]>();
    const problems: ScanProblem[] = [];

    for (const include of config.include) {
      const excludeGlob = config.exclude.length ? `{${config.exclude.join(',')}}` : undefined;
      const files = await vscode.workspace.findFiles(include, excludeGlob);
      for (const file of files) {
        const document = await vscode.workspace.openTextDocument(file);
        this.scanDocument(document, problems, usedKeys, defaultLocale);
      }
    }

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

  private scanDocument(
    document: vscode.TextDocument,
    problems: ScanProblem[],
    usedKeys: Map<string, { uri: vscode.Uri; range: vscode.Range }[]>,
    defaultLocale: Record<string, string>
  ): void {
    const sourceFile = ts.createSourceFile(document.fileName, document.getText(), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const functionName = getConfig().functionName;

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

      if ((ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) && this.isHardcodedCandidate(node)) {
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

  private isHardcodedCandidate(node: ts.StringLiteral | ts.NoSubstitutionTemplateLiteral): boolean {
    const parent = node.parent;
    if (ts.isImportDeclaration(parent) || ts.isExportDeclaration(parent)) {
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
      const ignoredKeys = new Set(['id', 'key', 'className', 'path', 'url', 'href', 'testId']);
      if (ignoredKeys.has(parent.name.text)) {
        return false;
      }
    }
    if (ts.isCallExpression(parent) && ts.isIdentifier(parent.expression) && parent.expression.text === getConfig().functionName) {
      return false;
    }
    return true;
  }
}
