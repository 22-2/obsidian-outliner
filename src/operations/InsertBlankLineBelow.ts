import { Operation } from "./Operation";

import { List, Root, recalculateNumericBullets } from "../root";
import { checkboxRe } from "../utils/checkboxRe";

export class InsertBlankLineBelow implements Operation {
  private stopPropagation = false;
  private updated = false;

  constructor(private root: Root, private defaultIndentChars: string) {}

  shouldStopPropagation() {
    return this.stopPropagation;
  }

  shouldUpdate() {
    return this.updated;
  }

  perform() {
    const { root } = this;

    if (!root.hasSingleSelection()) {
      return;
    }

    const selection = root.getSelection();
    if (!selection || selection.anchor.line !== selection.head.line) {
      return;
    }

    const list = root.getListUnderCursor();
    if (!list) {
      return;
    }

    const cursor = root.getCursor();

    this.stopPropagation = true;
    this.updated = true;

    const prefix = list.getLines()[0].match(checkboxRe) ? "[ ] " : "";

    const newList = new List(
      list.getRoot(),
      list.getFirstLineIndent(),
      list.getBullet(),
      prefix,
      list.getSpaceAfterBullet(),
      prefix,
      false,
    );

    list.getParent().addAfter(list, newList);

    root.replaceCursor({
      line: newList.getFirstLineContentStart().line,
      ch: newList.getFirstLineContentStart().ch + prefix.length,
    });

    recalculateNumericBullets(root);
  }
}
