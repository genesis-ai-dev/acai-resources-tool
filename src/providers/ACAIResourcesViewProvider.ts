import * as vscode from "vscode";
import { queryATLAS } from "../utils/queryATLAS";
import { vrefData } from "../utils/verseData";
import { AcaiRecord } from "../../types";
import { VerseRefGlobalState } from "../../types";

export class ACAIResourcesViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "acai-resources-sidebar";
  private state: ACAIResourcesState;
  private activeSearches: Map<string, AbortController> = new Map();
  private stateStoreExtension = vscode.extensions.getExtension(
    "project-accelerate.shared-state-store"
  );
  private storeListener: any;
  private disposeFunction: (() => void) | null = null;

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly context: vscode.ExtensionContext
  ) {
    this.state = this.loadState();
    this.initStateStore();
  }

  private async initStateStore() {
    if (this.stateStoreExtension) {
      try {
        const api = await this.stateStoreExtension.activate();
        if (!api) {
          throw new Error("State store extension does not expose an API.");
        }
        this.storeListener = api.storeListener;
      } catch (error) {
        console.error("Failed to initialize shared state store:", error);
        this.storeListener = null;
      }
    }
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this.setupWebview(webviewView);
    this.setupEventListeners(webviewView);

    // Dispose the listener when the webview is disposed
    webviewView.onDidDispose(() => {
      this.turnOffRefListener();
    });
  }

  // Helper methods

  private setupWebview(webviewView: vscode.WebviewView): void {
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri],
    };

    const codiconsUri = this.getCodiconsUri(webviewView);
    webviewView.webview.html = this.getHtmlForWebview(
      webviewView.webview,
      codiconsUri
    );

    this.sendInitialData(webviewView);
  }

  private setupEventListeners(webviewView: vscode.WebviewView): void {
    webviewView.onDidChangeVisibility(() => {
      if (!webviewView.visible) {
        this.saveState();
      }
    });

    webviewView.onDidDispose(() => this.saveState());

    webviewView.webview.onDidReceiveMessage((message) => {
      this.handleWebviewMessage(message, webviewView);
    });
  }

  private handleWebviewMessage(
    message: any,
    webviewView: vscode.WebviewView
  ): void {
    switch (message.command) {
      case "requestInitialData":
        this.sendInitialData(webviewView);
        break;
      case "search":
        this.handleSearch(message, webviewView);
        break;
      case "cancelSearch":
        this.handleCancelSearch(message.searchId, webviewView);
        break;
      case "updateState":
        this.updateState(message.state);
        break;
      case "requestStateRestore":
        this.restoreState(webviewView);
        break;
      case "updatePinnedRecords":
        this.updatePinnedRecords(message.pinnedRecords, webviewView);
        break;
    }
  }

  private getBookData(): BookData[] {
    return Object.entries(vrefData)
      .map(([id, book]): BookData | null => {
        if (book.name) {
          return { id, name: book.name };
        }
        return null;
      })
      .filter((book): book is BookData => book !== null)
      .sort((a, b) => {
        const ordA = vrefData[a.id]?.ord;
        const ordB = vrefData[b.id]?.ord;
        return ordA && ordB ? ordA.localeCompare(ordB) : 0;
      });
  }

  private async handleSearch(
    message: SearchMessage,
    webviewView: vscode.WebviewView
  ): Promise<void> {
    const { bookId, verseRef, labelInput, searchType, searchId } = message;
    const abortController = new AbortController();
    this.activeSearches.set(searchId, abortController);

    try {
      const result = await queryATLAS(
        bookId,
        verseRef,
        this.state.selectedTypes,
        labelInput,
        searchType,
        abortController.signal
      );

      this.updateState({
        selectedOption: searchType === "Reference" ? bookId : "",
        textInput: searchType === "Reference" ? verseRef : "",
        searchResult: result,
        labelInput,
        searchType,
      });

      webviewView.webview.postMessage({
        command: "searchResult",
        result,
        searchId,
      });
    } catch (error) {
      this.handleSearchError(error, searchId, webviewView);
    } finally {
      this.activeSearches.delete(searchId);
    }
  }

  private handleCancelSearch(
    searchId: string,
    webviewView: vscode.WebviewView
  ): void {
    const abortController = this.activeSearches.get(searchId);
    if (abortController) {
      abortController.abort();
      this.activeSearches.delete(searchId);
      webviewView.webview.postMessage({ command: "searchCancelled", searchId });
    }
  }

  private updatePinnedRecords(
    pinnedRecords: AcaiRecord[],
    webviewView: vscode.WebviewView
  ): void {
    this.updateState({ pinnedRecords });
    webviewView.webview.postMessage({
      command: "updatePinnedRecords",
      pinnedRecords: this.state.pinnedRecords,
    });
  }

  private handleSearchError(
    error: any,
    searchId: string,
    webviewView: vscode.WebviewView
  ): void {
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
  }

  private restoreState(webviewView: vscode.WebviewView): void {
    webviewView.webview.postMessage({
      command: "restoreState",
      selectedOption: this.state.selectedOption,
      textInput: this.state.textInput,
      searchResult: this.state.searchResult,
      selectedTypes: this.state.selectedTypes,
      searchType: this.state.searchType,
      labelInput: this.state.labelInput,
      topLevelLabelInput: this.state.topLevelLabelInput,
      pinnedRecords: this.state.pinnedRecords,
    });
  }

  // State management

  private loadState(): ACAIResourcesState {
    const savedState =
      this.context.globalState.get<ACAIResourcesState>("acaiResourcesState") ||
      {};
    return { selectedTypes: [], pinnedRecords: [], ...savedState };
  }

  private saveState(): void {
    this.context.globalState.update("acaiResourcesState", this.state);
  }

  private updateState(newState: Partial<ACAIResourcesState>): void {
    this.state = { ...this.state, ...newState };
    this.saveState();
  }

  // HTML generation

  private getHtmlForWebview(
    webview: vscode.Webview,
    codiconsUri: vscode.Uri
  ): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(
        this.extensionUri,
        "dist",
        "webviews",
        "ACAIResourceView",
        "index.js"
      )
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(
        this.extensionUri,
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

  // Helper methods

  private getCodiconsUri(webviewView: vscode.WebviewView): vscode.Uri {
    return webviewView.webview.asWebviewUri(
      vscode.Uri.joinPath(
        this.extensionUri,
        "node_modules",
        "@vscode/codicons",
        "dist",
        "codicon.css"
      )
    );
  }

  private sendInitialData(webviewView: vscode.WebviewView): void {
    const bookData = this.getBookData();
    webviewView.webview.postMessage({
      command: "setBookData",
      bookData: bookData,
    });

    webviewView.webview.postMessage({
      command: "restoreState",
      selectedOption: this.state.selectedOption,
      textInput: this.state.textInput,
      searchResult: this.state.searchResult,
      selectedTypes: this.state.selectedTypes,
      searchType: this.state.searchType,
      labelInput: this.state.labelInput,
      topLevelLabelInput: this.state.topLevelLabelInput,
      pinnedRecords: this.state.pinnedRecords,
    });
  }

  private turnOnRefListener(webviewView: vscode.WebviewView): void {
    if (!this.storeListener) {
      this.initStateStore();
    }
    if (this.storeListener && !this.disposeFunction) {
      this.disposeFunction = this.storeListener(
        "verseRef",
        (value: VerseRefGlobalState) => {
          if (value) {
            // cut off everything after and including the colon
            const verseRef = value.verseRef.split(":")[0];
            console.log(`VerseRef from state store: ${verseRef}`);
            webviewView.webview.postMessage({
              command: "reload",
              data: { verseRef, uri: value.uri },
            });
          }
        }
      );
      vscode.window.showInformationMessage("Reference listener turned on.");
    } else {
      vscode.window.showWarningMessage(
        "Automatic verse reference search is unavailable. Make sure the Shared State Store extension is installed and reload the window to try again."
      );
    }
  }

  private turnOffRefListener(): void {
    if (this.disposeFunction) {
      this.disposeFunction();
      this.disposeFunction = null;
      vscode.window.showInformationMessage("Reference listener turned off.");
    }
  }
}

// Types

interface ACAIResourcesState {
  selectedOption?: string;
  textInput?: string;
  searchResult?: AcaiRecord[];
  selectedTypes: string[];
  searchType?: string;
  labelInput?: string;
  topLevelLabelInput?: string;
  pinnedRecords: AcaiRecord[];
}

interface BookData {
  id: string;
  name: string;
}

interface SearchMessage {
  bookId: string;
  verseRef: string;
  labelInput: string;
  searchType: string;
  searchId: string;
}

// interface VerseRefGlobalState {
//   verseRef: string;
//   uri: string;
// }
