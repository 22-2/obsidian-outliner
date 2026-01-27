import { Plugin } from "obsidian";

import { EditorState, Transaction } from "@codemirror/state";

import { Feature } from "./Feature";

import { MyEditor, getEditorFromState } from "../editor";
import { KeepCursorOutsideFoldedLines } from "../operations/KeepCursorOutsideFoldedLines";
import { KeepCursorWithinListContent } from "../operations/KeepCursorWithinListContent";
import { OperationPerformer } from "../services/OperationPerformer";
import { Parser } from "../services/Parser";
import { Settings } from "../services/Settings";

export class EditorSelectionsBehaviourOverride implements Feature {
  private debounceTimer: number | null = null;
  private readonly DEBOUNCE_DELAY = 16; // ~60fps

  constructor(
    private plugin: Plugin,
    private settings: Settings,
    private parser: Parser,
    private operationPerformer: OperationPerformer,
  ) {}

  async load() {
    this.plugin.registerEditorExtension(
      EditorState.transactionExtender.of(this.transactionExtender),
    );
  }

  async unload() {
    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  }

  private transactionExtender = (tr: Transaction): null => {
    if (this.settings.keepCursorWithinContent === "never" || !tr.selection) {
      return null;
    }

    const editor = getEditorFromState(tr.startState);
    if (!editor) {
      return null;
    }

    // Debounce the selection changes handling
    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer);
    }

    // this.debounceTimer = window.setTimeout(() => {
    //   this.debounceTimer = null;
    // }, this.DEBOUNCE_DELAY);
    queueMicrotask(() => {
      if (!editor.isAlive()) {
        return;
      }
      this.handleSelectionsChanges(editor);
    });

    return null;
  };

  private handleSelectionsChanges = (editor: MyEditor) => {
    const root = this.parser.parse(editor);

    if (!root) {
      return;
    }

    {
      const { shouldStopPropagation } = this.operationPerformer.eval(
        root,
        new KeepCursorOutsideFoldedLines(root),
        editor,
      );

      if (shouldStopPropagation) {
        return;
      }
    }

    this.operationPerformer.eval(
      root,
      new KeepCursorWithinListContent(root),
      editor,
    );
  };
}
