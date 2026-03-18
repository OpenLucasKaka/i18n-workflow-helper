import * as ts from 'typescript';
import * as vscode from 'vscode';
import { getConfig } from '../config';
import { getScriptKind } from '../languageSupport';
import { ExtractTarget } from '../types';
import { stripQuotes } from '../utils';
import { getVueExtractTarget } from '../vueSupport';

export class CodeReplaceService {
  getExtractTarget(document: vscode.TextDocument, selection: vscode.Selection, key: string): ExtractTarget | null {
    if (document.fileName.endsWith('.vue')) {
      return getVueExtractTarget(document, selection, key, getConfig().functionName);
    }

    const scriptKind = getScriptKind(document);
    if (scriptKind === ts.ScriptKind.Unknown) {
      return null;
    }

    const sourceFile = ts.createSourceFile(
      document.fileName,
      document.getText(),
      ts.ScriptTarget.Latest,
      true,
      scriptKind
    );
    const start = document.offsetAt(selection.start);
    const end = document.offsetAt(selection.end);
    const functionName = getConfig().functionName;

    let match: ExtractTarget | null = null;
    const visit = (node: ts.Node): void => {
      if (start >= node.getStart(sourceFile) && end <= node.getEnd()) {
        if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
          const range = new vscode.Range(document.positionAt(node.getStart(sourceFile)), document.positionAt(node.getEnd()));
          match = {
            range,
            text: stripQuotes(node.getText(sourceFile)),
            replacement: `${functionName}('${key}')`
          };
          return;
        }
        if (ts.isJsxText(node)) {
          const range = new vscode.Range(document.positionAt(node.getStart(sourceFile)), document.positionAt(node.getEnd()));
          match = {
            range,
            text: node.getText(sourceFile).trim(),
            replacement: `{${functionName}('${key}')}`
          };
          return;
        }
      }
      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
    return match;
  }

  async replaceSelection(document: vscode.TextDocument, target: ExtractTarget): Promise<boolean> {
    const edit = new vscode.WorkspaceEdit();
    edit.replace(document.uri, target.range, target.replacement);
    return vscode.workspace.applyEdit(edit);
  }

  async replaceSelections(document: vscode.TextDocument, targets: ExtractTarget[]): Promise<boolean> {
    const edit = new vscode.WorkspaceEdit();
    const sortedTargets = [...targets].sort(
      (left, right) => document.offsetAt(right.range.start) - document.offsetAt(left.range.start)
    );

    for (const target of sortedTargets) {
      edit.replace(document.uri, target.range, target.replacement);
    }

    return vscode.workspace.applyEdit(edit);
  }
}
