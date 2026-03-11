import * as vscode from 'vscode';

export class ImportPreviewContentProvider implements vscode.TextDocumentContentProvider {
  private readonly emitter = new vscode.EventEmitter<vscode.Uri>();
  readonly onDidChange = this.emitter.event;
  private readonly content = new Map<string, string>();

  set(uri: vscode.Uri, value: string): void {
    this.content.set(uri.toString(), value);
    this.emitter.fire(uri);
  }

  delete(uri: vscode.Uri): void {
    this.content.delete(uri.toString());
    this.emitter.fire(uri);
  }

  provideTextDocumentContent(uri: vscode.Uri): string {
    return this.content.get(uri.toString()) ?? '';
  }
}
