import * as ts from 'typescript';
import * as vscode from 'vscode';
import { getConfig } from '../config';
import { ExtractTarget } from '../types';
import { stripQuotes } from '../utils';

export class CodeReplaceService {
  getExtractTarget(document: vscode.TextDocument, selection: vscode.Selection, key: string): ExtractTarget | null {
    const sourceFile = ts.createSourceFile(document.fileName, document.getText(), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
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
}
