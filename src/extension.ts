import * as vscode from "vscode";
import { AcaiTreeProvider } from "./treeViewProvider";
import { WebviewProvider } from "./webviewProvider";

export function activate(context: vscode.ExtensionContext) {
  console.log("acai-resources-tool is now active");

  // Register the tree view
  const treeDataProvider = new AcaiTreeProvider();
  vscode.window.createTreeView("acaiResourcesView", {
    treeDataProvider: treeDataProvider,
  });

  // Register the command to open the webview
  let openWebviewDisposable = vscode.commands.registerCommand(
    "acai-resources-tool.openWebview",
    () => {
      WebviewProvider.createOrShow(context);
    }
  );

  // Register the original hello world command
  let helloWorldDisposable = vscode.commands.registerCommand(
    "acai-resources-tool.helloWorld",
    () => {
      vscode.window.showInformationMessage(
        "Hello World from acai-resources-tool."
      );
    }
  );

  context.subscriptions.push(openWebviewDisposable, helloWorldDisposable);
}

export function deactivate() {}
