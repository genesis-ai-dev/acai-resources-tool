import * as vscode from "vscode";
import { queryATLAS } from "../utils/queryATLAS";
import { vrefData } from "../utils/verseData";
import { AcaiRecord } from "../../types";

export class ACAIResourcesViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "acai-resources-sidebar";
  private state: {
    selectedOption?: string;
    textInput?: string;
    searchResult?: AcaiRecord[];
    selectedTypes: string[];
    searchType?: string;
    labelInput?: string;
    topLevelLabelInput?: string;
  } = {
    selectedTypes: [],
  };

  private activeSearches: Map<string, AbortController> = new Map();

  constructor(
    private readonly _extensionUri: vscode.Uri,
    private readonly _context: vscode.ExtensionContext
  ) {
    console.log("ACAIResourcesViewProvider initialized");
    const savedState =
      this._context.globalState.get("acaiResourcesState") || {};
    this.state = {
      selectedTypes: [],
      ...savedState,
    };
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

    const codiconsUri = webviewView.webview.asWebviewUri(
      vscode.Uri.joinPath(
        this._extensionUri,
        "node_modules",
        "@vscode/codicons",
        "dist",
        "codicon.css"
      )
    );

    webviewView.webview.html = this._getHtmlForWebview(
      webviewView.webview,
      codiconsUri
    );

    // Get book data and send it to the webview
    const bookData = this.getBookData();
    console.log("Sending book data to webview:", bookData);
    webviewView.webview.postMessage({
      command: "setBookData",
      bookData: bookData,
    });

    // Restore state if available
    if (this.state.selectedOption && this.state.textInput) {
      console.log("Restoring state:", this.state);
      webviewView.webview.postMessage({
        command: "restoreState",
        selectedOption: this.state.selectedOption,
        textInput: this.state.textInput,
        searchResult: this.state.searchResult,
        selectedTypes: this.state.selectedTypes,
        searchType: this.state.searchType,
        labelInput: this.state.labelInput,
        topLevelLabelInput: this.state.topLevelLabelInput,
      });
    }

    // Add listeners for webview visibility changes
    webviewView.onDidChangeVisibility(() => {
      if (!webviewView.visible) {
        console.log("Webview is being hidden, saving state");
        this.saveState();
      }
    });

    webviewView.onDidDispose(() => {
      console.log("Webview is being disposed, saving state");
      this.saveState();
    });

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
          // Also send the current state
          webviewView.webview.postMessage({
            command: "restoreState",
            selectedOption: this.state.selectedOption,
            textInput: this.state.textInput,
            searchResult: this.state.searchResult,
            selectedTypes: this.state.selectedTypes,
            searchType: this.state.searchType,
            labelInput: this.state.labelInput,
            topLevelLabelInput: this.state.topLevelLabelInput,
          });
          return;
        case "search":
          this.handleSearch(
            message.bookId,
            message.verseRef,
            webviewView,
            message.labelInput,
            message.searchType,
            message.searchId
          );
          return;
        case "cancelSearch":
          this.handleCancelSearch(message.searchId, webviewView);
          return;
        case "updateState":
          // Add this case to handle state updates from the webview
          this.state = { ...this.state, ...message.state };
          this.saveState();
          return;
        case "requestStateRestore":
          console.log("Received requestStateRestore, sending current state");
          webviewView.webview.postMessage({
            command: "restoreState",
            selectedOption: this.state.selectedOption,
            textInput: this.state.textInput,
            searchResult: this.state.searchResult,
            selectedTypes: this.state.selectedTypes,
            searchType: this.state.searchType,
            labelInput: this.state.labelInput,
            topLevelLabelInput: this.state.topLevelLabelInput,
          });
          return;
      }
    });
  }

  private getBookData() {
    console.log("Fetching book data");
    const bookData = Object.entries(vrefData)
      .map(([id, book]) => {
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
    webviewView: vscode.WebviewView,
    labelInput: string,
    searchType: string,
    searchId: string
  ) {
    console.log(
      `Handling search for book ${bookId}, verse ${verseRef}, label input: ${labelInput}, search type: ${searchType}, search ID: ${searchId}`
    );
    const abortController = new AbortController();
    this.activeSearches.set(searchId, abortController);

    try {
      const result: AcaiRecord[] = await queryATLAS(
        bookId,
        verseRef,
        this.state.selectedTypes || [],
        labelInput,
        searchType,
        abortController.signal
      );
      console.log("Search completed successfully");

      // Save state
      this.state = {
        ...this.state,
        selectedOption: searchType === "Reference" ? bookId : "",
        textInput: searchType === "Reference" ? verseRef : "",
        searchResult: result,
        labelInput: labelInput,
        searchType: searchType,
      };
      this.saveState();

      webviewView.webview.postMessage({
        command: "searchResult",
        result: result,
        searchId: searchId,
      });
    } catch (error) {
      console.error("Error querying ATLAS:", error);
      let errorMessage = "An error occurred while searching. Please try again.";
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      if (errorMessage !== "Search cancelled") {
        webviewView.webview.postMessage({
          command: "searchError",
          error: errorMessage,
          searchId: searchId,
        });
      }
    } finally {
      this.activeSearches.delete(searchId);
    }
  }

  private handleCancelSearch(
    searchId: string,
    webviewView: vscode.WebviewView
  ) {
    console.log(`Cancelling search with ID: ${searchId}`);
    const abortController = this.activeSearches.get(searchId);
    if (abortController) {
      abortController.abort();
      this.activeSearches.delete(searchId);
      webviewView.webview.postMessage({
        command: "searchCancelled",
        searchId: searchId,
      });
    }
  }

  private saveState() {
    console.log("Saving state:", this.state);
    this._context.globalState.update("acaiResourcesState", this.state);
  }

  private _getHtmlForWebview(webview: vscode.Webview, codiconsUri: vscode.Uri) {
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
                <link href="${codiconsUri}" rel="stylesheet">
                <title>ACAI Resources</title>
            </head>
            <body>
                <div id="root"></div>
                <script src="${scriptUri}"></script>
            </body>
            </html>`;
  }
}
