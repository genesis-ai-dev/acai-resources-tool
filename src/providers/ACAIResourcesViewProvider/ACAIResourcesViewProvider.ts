import * as vscode from "vscode";
import { vrefData } from "../../utils/verseData";
import { queryATLAS } from "../../utils/queryATLAS";

export class ACAIResourcesViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "acai-resources-sidebar";

  constructor(private readonly _extensionUri: vscode.Uri) {}

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri],
    };

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

    // Send initial data to the webview
    const bookOptions = Object.entries(vrefData)
      .sort(([, a], [, b]) => parseInt(a.ord ?? "0") - parseInt(b.ord ?? "0"))
      .map(([, bookData]) => ({
        name: bookData.name ?? "",
        id: bookData.id ?? "",
      }));

    webviewView.webview.postMessage({
      command: "setOptions",
      options: bookOptions,
    });

    // Add message listener
    webviewView.webview.onDidReceiveMessage((message) => {
      switch (message.command) {
        case "search":
          this.handleSearch(message.bookId, message.verseRef, webviewView);
          return;
      }
    });
  }

  private async handleSearch(
    bookId: string,
    verseRef: string,
    webviewView: vscode.WebviewView
  ) {
    try {
      const result = await queryATLAS(bookId, verseRef);
      webviewView.webview.postMessage({
        command: "searchResult",
        result: result,
      });
    } catch (error) {
      console.error("Error querying ATLAS:", error);
      webviewView.webview.postMessage({
        command: "searchError",
        error: "An error occurred while searching. Please try again.",
      });
    }
  }

  private _getHtmlForWebview(webview: vscode.Webview) {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(
        this._extensionUri,
        "webviews",
        "dist",
        "ACAIResourceView",
        "index.js"
      )
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(
        this._extensionUri,
        "webviews",
        "dist",
        "ACAIResourceView",
        "index.css"
      )
    );

    return `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <link href="${styleUri}" rel="stylesheet">
                <title>ACAI Resources</title>
            </head>
            <body>
                <div id="root"></div>
                <script src="${scriptUri}"></script>
            </body>
            </html>`;
  }
}
