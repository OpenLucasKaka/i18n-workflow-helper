import { baseParse, InterpolationNode, NodeTypes, RootNode, TemplateChildNode } from '@vue/compiler-dom';
import { SFCBlock, parse as parseSfc } from '@vue/compiler-sfc';
import * as ts from 'typescript';
import * as vscode from 'vscode';
import { ExtractTarget, ScanProblem } from './types';
import { isNaturalLanguage, stripQuotes } from './utils';

function toRange(document: vscode.TextDocument, start: number, end: number): vscode.Range {
  return new vscode.Range(document.positionAt(start), document.positionAt(end));
}

function getBlockScriptKind(block: SFCBlock): ts.ScriptKind {
  switch (block.lang) {
    case 'ts':
      return ts.ScriptKind.TS;
    case 'tsx':
      return ts.ScriptKind.TSX;
    case 'jsx':
      return ts.ScriptKind.JSX;
    default:
      return ts.ScriptKind.JS;
  }
}

function createEmbeddedSourceFile(fileName: string, content: string, kind: ts.ScriptKind): ts.SourceFile {
  return ts.createSourceFile(fileName, content, ts.ScriptTarget.Latest, true, kind);
}

export function getVueExtractTarget(
  document: vscode.TextDocument,
  selection: vscode.Selection,
  key: string,
  functionName: string
): ExtractTarget | null {
  const { descriptor } = parseSfc(document.getText(), { filename: document.fileName });
  const start = document.offsetAt(selection.start);
  const end = document.offsetAt(selection.end);

  const scriptTarget =
    findScriptExtractTarget(document, descriptor.scriptSetup, start, end, key, functionName) ??
    findScriptExtractTarget(document, descriptor.script, start, end, key, functionName);
  if (scriptTarget) {
    return scriptTarget;
  }

  if (descriptor.template) {
    const templateOffset = descriptor.template.loc.start.offset;
    const templateEnd = descriptor.template.loc.end.offset;
    if (start >= templateOffset && end <= templateEnd) {
      const localStart = start - templateOffset;
      const localEnd = end - templateOffset;
      const ast = baseParse(descriptor.template.content);
      const templateTarget = findTemplateExtractTarget(document, ast, localStart, localEnd, templateOffset, key, functionName);
      if (templateTarget) {
        return templateTarget;
      }
    }
  }

  return null;
}

function findScriptExtractTarget(
  document: vscode.TextDocument,
  block: SFCBlock | null | undefined,
  start: number,
  end: number,
  key: string,
  functionName: string
): ExtractTarget | null {
  if (!block) {
    return null;
  }
  const blockStart = block.loc.start.offset;
  const blockEnd = block.loc.end.offset;
  if (start < blockStart || end > blockEnd) {
    return null;
  }

  const localStart = start - blockStart;
  const localEnd = end - blockStart;
  const sourceFile = createEmbeddedSourceFile(document.fileName, block.content, getBlockScriptKind(block));
  let match: ExtractTarget | null = null;

  const visit = (node: ts.Node): void => {
    if (localStart >= node.getStart(sourceFile) && localEnd <= node.getEnd()) {
      if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
        match = {
          range: toRange(document, blockStart + node.getStart(sourceFile), blockStart + node.getEnd()),
          text: stripQuotes(node.getText(sourceFile)),
          replacement: `${functionName}('${key}')`
        };
        return;
      }
    }
    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return match;
}

function findTemplateExtractTarget(
  document: vscode.TextDocument,
  root: RootNode,
  localStart: number,
  localEnd: number,
  templateOffset: number,
  key: string,
  functionName: string
): ExtractTarget | null {
  let match: ExtractTarget | null = null;

  const visit = (node: TemplateChildNode): void => {
    if (match) {
      return;
    }

    if (node.type === NodeTypes.TEXT) {
      const start = node.loc.start.offset;
      const end = node.loc.end.offset;
      if (localStart >= start && localEnd <= end && node.content.trim()) {
        match = {
          range: toRange(document, templateOffset + start, templateOffset + end),
          text: node.content.trim(),
          replacement: `{{ ${functionName}('${key}') }}` 
        };
        return;
      }
    }

    if (node.type === NodeTypes.ELEMENT) {
      for (const child of node.children) {
        visit(child);
      }
    }
  };

  for (const child of root.children) {
    visit(child);
  }

  return match;
}

export function scanVueDocument(
  document: vscode.TextDocument,
  functionName: string,
  defaultLocale: Record<string, string>,
  usedKeys: Map<string, { uri: vscode.Uri; range: vscode.Range }[]>,
  problems: ScanProblem[]
): void {
  const { descriptor } = parseSfc(document.getText(), { filename: document.fileName });

  scanVueScriptBlock(document, descriptor.script, functionName, defaultLocale, usedKeys, problems);
  scanVueScriptBlock(document, descriptor.scriptSetup, functionName, defaultLocale, usedKeys, problems);

  if (descriptor.template) {
    scanVueTemplate(document, descriptor.template.content, descriptor.template.loc.start.offset, functionName, defaultLocale, usedKeys, problems);
  }
}

function scanVueScriptBlock(
  document: vscode.TextDocument,
  block: SFCBlock | null | undefined,
  functionName: string,
  defaultLocale: Record<string, string>,
  usedKeys: Map<string, { uri: vscode.Uri; range: vscode.Range }[]>,
  problems: ScanProblem[]
): void {
  if (!block) {
    return;
  }

  const blockOffset = block.loc.start.offset;
  const sourceFile = createEmbeddedSourceFile(document.fileName, block.content, getBlockScriptKind(block));
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === functionName) {
      const firstArg = node.arguments[0];
      if (firstArg && ts.isStringLiteral(firstArg)) {
        const key = firstArg.text;
        const range = toRange(document, blockOffset + firstArg.getStart(sourceFile), blockOffset + firstArg.getEnd());
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

    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      const parent = node.parent;
      if (ts.isImportDeclaration(parent) || ts.isExportDeclaration(parent)) {
        ts.forEachChild(node, visit);
        return;
      }
      if (ts.isCallExpression(parent) && ts.isIdentifier(parent.expression) && parent.expression.text === functionName) {
        ts.forEachChild(node, visit);
        return;
      }

      const text = stripQuotes(node.getText(sourceFile));
      if (isNaturalLanguage(text)) {
        problems.push({
          type: 'hardcoded-text',
          message: `Hardcoded text: ${text}`,
          severity: vscode.DiagnosticSeverity.Warning,
          uri: document.uri,
          range: toRange(document, blockOffset + node.getStart(sourceFile), blockOffset + node.getEnd())
        });
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
}

function scanVueTemplate(
  document: vscode.TextDocument,
  templateContent: string,
  templateOffset: number,
  functionName: string,
  defaultLocale: Record<string, string>,
  usedKeys: Map<string, { uri: vscode.Uri; range: vscode.Range }[]>,
  problems: ScanProblem[]
): void {
  const ast = baseParse(templateContent);

  const visitNode = (node: TemplateChildNode): void => {
    if (node.type === NodeTypes.TEXT) {
      const text = node.content.trim();
      if (isNaturalLanguage(text)) {
        problems.push({
          type: 'hardcoded-text',
          message: `Hardcoded text: ${text}`,
          severity: vscode.DiagnosticSeverity.Warning,
          uri: document.uri,
          range: toRange(document, templateOffset + node.loc.start.offset, templateOffset + node.loc.end.offset)
        });
      }
    }

    if (node.type === NodeTypes.INTERPOLATION) {
      scanVueExpression(document, node, templateOffset, functionName, defaultLocale, usedKeys, problems);
    }

    if (node.type === NodeTypes.ELEMENT) {
      for (const child of node.children) {
        visitNode(child);
      }
    }
  };

  for (const child of ast.children) {
    visitNode(child);
  }
}

function scanVueExpression(
  document: vscode.TextDocument,
  node: InterpolationNode,
  templateOffset: number,
  functionName: string,
  defaultLocale: Record<string, string>,
  usedKeys: Map<string, { uri: vscode.Uri; range: vscode.Range }[]>,
  problems: ScanProblem[]
): void {
  const expression = node.content.loc.source;
  const sourceFile = ts.createSourceFile(document.fileName, expression, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

  const visit = (tsNode: ts.Node): void => {
    if (ts.isCallExpression(tsNode) && ts.isIdentifier(tsNode.expression) && tsNode.expression.text === functionName) {
      const firstArg = tsNode.arguments[0];
      if (firstArg && ts.isStringLiteral(firstArg)) {
        const key = firstArg.text;
        const range = toRange(
          document,
          templateOffset + node.content.loc.start.offset + firstArg.getStart(sourceFile),
          templateOffset + node.content.loc.start.offset + firstArg.getEnd()
        );
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
    ts.forEachChild(tsNode, visit);
  };

  visit(sourceFile);
}
