import { Plugin } from "obsidian";

import { Feature } from "./Feature";

import { MyEditor } from "../editor";
import { IndentList } from "../operations/IndentList";
import { MoveListDown } from "../operations/MoveListDown";
import { MoveListUp } from "../operations/MoveListUp";
import { OutdentList } from "../operations/OutdentList";
import { InsertBlankLineAbove } from "../operations/InsertBlankLineAbove";
import { InsertBlankLineBelow } from "../operations/InsertBlankLineBelow";
import { ObsidianSettings } from "../services/ObsidianSettings";
import { OperationPerformer } from "../services/OperationPerformer";
import { createEditorCallback } from "../utils/createEditorCallback";

export class ListsMovementCommands implements Feature {
  constructor(
    private plugin: Plugin,
    private obsidianSettings: ObsidianSettings,
    private operationPerformer: OperationPerformer,
  ) {}

  async load() {
    this.plugin.addCommand({
      id: "move-list-item-up",
      icon: "arrow-up",
      name: "Move list and sublists up",
      editorCallback: createEditorCallback(this.moveListUp),
      hotkeys: [
        {
          modifiers: ["Mod", "Shift"],
          key: "ArrowUp",
        },
      ],
    });

    this.plugin.addCommand({
      id: "move-list-item-down",
      icon: "arrow-down",
      name: "Move list and sublists down",
      editorCallback: createEditorCallback(this.moveListDown),
      hotkeys: [
        {
          modifiers: ["Mod", "Shift"],
          key: "ArrowDown",
        },
      ],
    });

    this.plugin.addCommand({
      id: "indent-list",
      icon: "indent",
      name: "Indent the list and sublists",
      editorCallback: createEditorCallback(this.indentList),
      hotkeys: [],
    });

    this.plugin.addCommand({
      id: "outdent-list",
      icon: "outdent",
      name: "Outdent the list and sublists",
      editorCallback: createEditorCallback(this.outdentList),
      hotkeys: [],
    });

    this.plugin.addCommand({
      id: "insert-blank-line-above",
      icon: "arrow-up-right",
      name: "Insert blank list item above",
      editorCallback: createEditorCallback(this.insertAbove),
      hotkeys: [],
    });

    this.plugin.addCommand({
      id: "insert-blank-line-below",
      icon: "arrow-down-right",
      name: "Insert blank list item below",
      editorCallback: createEditorCallback(this.insertBelow),
      hotkeys: [],
    });
  }

  async unload() {}

  private moveListDown = (editor: MyEditor) => {
    const { shouldStopPropagation } = this.operationPerformer.perform(
      (root) => new MoveListDown(root),
      editor,
    );

    return shouldStopPropagation;
  };

  private moveListUp = (editor: MyEditor) => {
    const { shouldStopPropagation } = this.operationPerformer.perform(
      (root) => new MoveListUp(root),
      editor,
    );

    return shouldStopPropagation;
  };

  private indentList = (editor: MyEditor) => {
    const { shouldStopPropagation } = this.operationPerformer.perform(
      (root) =>
        new IndentList(root, this.obsidianSettings.getDefaultIndentChars()),
      editor,
    );

    return shouldStopPropagation;
  };

  private outdentList = (editor: MyEditor) => {
    const { shouldStopPropagation } = this.operationPerformer.perform(
      (root) => new OutdentList(root),
      editor,
    );

    return shouldStopPropagation;
  };

  private insertAbove = (editor: MyEditor) => {
    const res = this.operationPerformer.perform(
      (root) => new InsertBlankLineAbove(root, this.obsidianSettings.getDefaultIndentChars()),
      editor,
    );

    if (res.shouldStopPropagation || res.shouldUpdate) {
      return res.shouldStopPropagation;
    }

    // Fallback for non-list locations: insert raw empty line above current line
    const cursor = editor.getCursor();
    const pos = { line: cursor.line, ch: 0 };
    editor.replaceRange("\n", pos, pos);
    editor.setSelections([
      { anchor: { line: cursor.line, ch: 0 }, head: { line: cursor.line, ch: 0 } },
    ]);

    return true;
  };

  private insertBelow = (editor: MyEditor) => {
    const { shouldStopPropagation } = this.operationPerformer.perform(
      (root) => new InsertBlankLineBelow(root, this.obsidianSettings.getDefaultIndentChars()),
      editor,
    );

    return shouldStopPropagation;
  };
}
