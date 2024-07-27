import * as vscode from "vscode";

export class AcaiTreeProvider
  implements vscode.TreeDataProvider<vscode.TreeItem>
{
  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: vscode.TreeItem): Thenable<vscode.TreeItem[]> {
    if (element) {
      return Promise.resolve([]);
    } else {
      const item = new vscode.TreeItem(
        "Open ACAI Webview",
        vscode.TreeItemCollapsibleState.None
      );
      item.command = {
        command: "acai-resources-tool.openWebview",
        title: "Open Webview",
      };
      item.iconPath = new vscode.ThemeIcon("notebook"); // Or use a custom icon
      return Promise.resolve([item]);
    }
  }
}
