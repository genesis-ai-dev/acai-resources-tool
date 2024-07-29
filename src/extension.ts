import * as vscode from "vscode";
import { ACAIResourcesViewProvider } from "./providers/ACAIResourcesViewProvider/ACAIResourcesViewProvider";

export function activate(context: vscode.ExtensionContext) {
  const provider = new ACAIResourcesViewProvider(context.extensionUri);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      ACAIResourcesViewProvider.viewType,
      provider
    )
  );

  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "acai-resources-tool.refreshResources",
      () => {
        vscode.window.showInformationMessage("Refreshing ACAI resources...");
        // Add logic to refresh resources
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("acai-resources-tool.addResource", () => {
      vscode.window
        .showInputBox({
          prompt: "Enter the name of the new resource",
          placeHolder: "New Resource",
        })
        .then((resourceName) => {
          if (resourceName) {
            vscode.window.showInformationMessage(
              `Adding new resource: ${resourceName}`
            );
            // Add logic to add a new resource
          }
        });
    })
  );

  // Add event listener for configuration changes
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("acai-resources-tool")) {
        vscode.window.showInformationMessage(
          "ACAI Resources Tool configuration changed"
        );
        // Add logic to handle configuration changes
      }
    })
  );
}

export function deactivate() {}
