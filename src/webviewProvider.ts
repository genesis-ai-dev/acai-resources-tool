import * as vscode from "vscode";
import * as path from "path";

export class WebviewProvider {
  private static panel: vscode.WebviewPanel | undefined;

  public static createOrShow(context: vscode.ExtensionContext) {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    if (WebviewProvider.panel) {
      WebviewProvider.panel.reveal(column);
    } else {
      WebviewProvider.panel = vscode.window.createWebviewPanel(
        "acaiWebview",
        "ACAI Webview",
        column || vscode.ViewColumn.One,
        {
          enableScripts: true,
          localResourceRoots: [
            vscode.Uri.file(path.join(context.extensionPath, "dist")),
          ],
        }
      );

      WebviewProvider.panel.webview.html = WebviewProvider.getWebviewContent(
        context,
        WebviewProvider.panel.webview
      );

      WebviewProvider.panel.onDidDispose(
        () => { 
          WebviewProvider.panel = undefined;
        },
        null,
        context.subscriptions
      );
    }
  }

  private static getWebviewContent(
    context: vscode.ExtensionContext,
    webview: vscode.Webview
  ): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.file(path.join(context.extensionPath, "dist", "webview.js"))
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.file(path.join(context.extensionPath, "dist", "webview.css"))
    );

    return `<!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>ACAI Webview</title>
          <link href="${styleUri}" rel="stylesheet">
      </head>
      <body>
          <div id="app"></div>
          <script src="${scriptUri}"></script>
      </body>
      </html>`;
  }
}
