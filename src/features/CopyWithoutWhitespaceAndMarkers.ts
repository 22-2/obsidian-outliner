import { MarkdownView, Notice, Plugin } from "obsidian";

import { Feature } from "./Feature";

export class CopyWithoutWhitespaceAndMarkers implements Feature {
  constructor(private plugin: Plugin) {}

  async load() {
    this.plugin.addCommand({
      id: "copy-without-whitespace-and-markers",
      name: "Copy without whitespace and list markers",
      callback: this.callback,
      hotkeys: [
        {
          modifiers: ["Mod", "Shift"],
          key: "C",
        },
      ],
    });
  }

  async unload() {}

  private stripMarkersAndWhitespace(text: string): string {
    // Remove common list markers at the start of lines (e.g. -, *, +, 1., 2)
    const withoutLineMarkers = text.replace(/^\s*(?:[-*+]|\d+[\.)])\s+/gm, "");
    // Remove bullet characters that might remain
    const withoutBullets = withoutLineMarkers.replace(/[-*+•]/g, "");
    // Remove horizontal whitespace (spaces, tabs) but keep newlines
    return withoutBullets.replace(/[ \t\u00A0]+/g, "");
  }

  private callback = () => {
    const view = this.plugin.app.workspace.getActiveViewOfType(MarkdownView);
    if (!view) {
      new Notice("No active markdown editor to copy from.");
      return;
    }

    const editor = view.editor;
    const selection = editor.getSelection();
    const source = selection && selection.length > 0 ? selection : editor.getValue();

    try {
      const result = this.stripMarkersAndWhitespace(source);
      // Copy to clipboard
      navigator.clipboard.writeText(result);
      new Notice("Copied text without whitespace/list markers to clipboard.");
    } catch (e) {
      console.error(e);
      new Notice("Failed to copy to clipboard");
    }
  };
}
