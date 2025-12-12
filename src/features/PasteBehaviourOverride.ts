import { Plugin } from "obsidian";
import { EditorView } from "@codemirror/view";

import { Feature } from "./Feature";

import { getEditorFromState } from "../editor";
import { PasteContent } from "../operations/PasteContent";
import { OperationPerformer } from "../services/OperationPerformer";
import { Settings } from "../services/Settings";

export class PasteBehaviourOverride implements Feature {
  constructor(
    private plugin: Plugin,
    private settings: Settings,
    private operationPerformer: OperationPerformer,
  ) {}

  async load() {
    this.plugin.registerEditorExtension(
      EditorView.domEventHandlers({
        paste: this.handlePaste,
      }),
    );
  }

  async unload() {}

  private handlePaste = (e: ClipboardEvent, view: EditorView) => {
    if (e.defaultPrevented) {
      return;
    }

    const editor = getEditorFromState(view.state);

    if (!editor) {
      return;
    }

    const text = e.clipboardData?.getData("text/plain");

    if (!text) {
      return;
    }

    const { shouldStopPropagation } = this.operationPerformer.perform(
      (root) => new PasteContent(root, text),
      editor,
    );

    if (shouldStopPropagation) {
      e.preventDefault();
    }
  };
}
