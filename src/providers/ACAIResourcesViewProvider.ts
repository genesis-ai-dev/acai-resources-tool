import * as vscode from "vscode";
import { queryATLAS } from "../utils/queryATLAS";
import { vrefData } from "../utils/verseData";
import { AcaiRecord } from "../../types";

export class ACAIResourcesViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "acai-resources-sidebar";

  constructor(private readonly _extensionUri: vscode.Uri) {
    console.log("ACAIResourcesViewProvider initialized");
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    console.log("Resolving webview view");
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri],
    };

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

    // Get book data and send it to the webview
    const bookData = this.getBookData();
    console.log("Sending book data to webview:", bookData);
    webviewView.webview.postMessage({
      command: "setBookData",
      bookData: bookData,
    });

    console.log("Message posted to webview");

    // Add message listener
    webviewView.webview.onDidReceiveMessage((message) => {
      console.log(`Received message from webview: ${JSON.stringify(message)}`);
      switch (message.command) {
        case "requestInitialData":
          console.log("Received requestInitialData, sending book data");
          const bookData = this.getBookData();
          webviewView.webview.postMessage({
            command: "setBookData",
            bookData: bookData,
          });
          return;
        case "search":
          this.handleSearch(message.bookId, message.verseRef, webviewView);
          return;
      }
    });
  }
  private getBookData() {
    console.log("Fetching book data");
    const bookData = Object.entries(vrefData)
      .map(([id, book]) => {
        console.log(`Processing book: ${id} - ${book.name}`);
        return { id, name: book.name };
      })
      .sort((a, b) => {
        const ordA = vrefData[a.id]?.ord;
        const ordB = vrefData[b.id]?.ord;
        if (ordA && ordB) {
          return ordA.localeCompare(ordB);
        }
        return 0;
      });
    console.log(`Sorted ${bookData.length} books`);
    return bookData;
  }

  private async handleSearch(
    bookId: string,
    verseRef: string,
    webviewView: vscode.WebviewView
  ) {
    console.log(`Handling search for book ${bookId}, verse ${verseRef}`);
    try {
      const result: AcaiRecord[] = await queryATLAS(bookId, verseRef);
      console.log("Search completed successfully");
      webviewView.webview.postMessage({
        command: "searchResult",
        result: result,
      });
    } catch (error) {
      console.error("Error querying ATLAS:", error);
      let errorMessage = "An error occurred while searching. Please try again.";
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      webviewView.webview.postMessage({
        command: "searchError",
        error: errorMessage,
      });
    }
  }

  private _getHtmlForWebview(webview: vscode.Webview) {
    console.log("Generating HTML for webview");
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(
        this._extensionUri,
        "dist",
        "webviews",
        "ACAIResourceView",
        "index.js"
      )
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(
        this._extensionUri,
        "dist",
        "webviews",
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
