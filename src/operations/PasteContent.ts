import { List, Root, recalculateNumericBullets } from "../root";
import { Operation } from "./Operation";

function normalizePastedLine(line: string): string {
  return line
    .replace(/\u3000/g, " ")
    .trim()
    .replace(/[\t ]+/g, " ");
}

export class PasteContent implements Operation {
  private stopPropagation = false;
  private updated = false;

  constructor(
    private root: Root,
    private content: string,
  ) {}

  shouldStopPropagation() {
    return this.stopPropagation;
  }

  shouldUpdate() {
    return this.updated;
  }

  perform(): void {
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

    const parent = list.getParent();
    if (!parent) {
      return;
    }

    const cursor = root.getCursor();
    const linesInfo = list.getLinesInfo();
    const lineUnderCursor = linesInfo.find((l) => l.from.line === cursor.line);
    if (!lineUnderCursor) {
      return;
    }

    if (selection.from < lineUnderCursor.from.ch || selection.to > lineUnderCursor.to.ch) {
      return;
    }

    const rawLines = this.content.split(/\r\n|\r|\n/);
    const pastedLines = rawLines
      .map(normalizePastedLine);

    if (pastedLines.length === 0) {
      return;
    }

    this.stopPropagation = true;
    this.updated = true;

    const selectionFromInLine = selection.from - lineUnderCursor.from.ch;
    const selectionToInLine = selection.to - lineUnderCursor.from.ch;

    const left = lineUnderCursor.text.slice(0, selectionFromInLine);
    const right = lineUnderCursor.text.slice(selectionToInLine);

    const beforeCursorLine = linesInfo
      .filter((l) => l.from.line < cursor.line)
      .map((l) => l.text);
    const afterCursorLine = linesInfo
      .filter((l) => l.from.line > cursor.line)
      .map((l) => l.text);

    const firstPasted = pastedLines[0];
    const restPasted = pastedLines.slice(1);

    // Update current list: keep only lines up to cursor line, replacing selection with first pasted line.
    list.replaceLines([...beforeCursorLine, left + firstPasted]);

    // Create sibling items for the rest pasted lines.
    let lastInserted: List = list;
    for (const line of restPasted) {
      const newList = new List(
        root,
        list.getFirstLineIndent(),
        list.getBullet(),
        "",
        list.getSpaceAfterBullet(),
        line,
        false,
      );

      parent.addAfter(lastInserted, newList);
      lastInserted = newList;
    }

    // Append the rest of the original content to the last inserted list.
    const lastInsertedLines = lastInserted.getLines();
    lastInsertedLines[0] = lastInsertedLines[0] + right;
    lastInserted.replaceLines(lastInsertedLines);

    if (afterCursorLine.length > 0) {
      const notesIndent = list.getNotesIndent();
      if (notesIndent) {
        lastInserted.setNotesIndent(notesIndent);
        for (const line of afterCursorLine) {
          lastInserted.addLine(line);
        }
      }
    }

    // Move cursor to end of pasted content (before the original right part).
    if (restPasted.length === 0) {
      root.replaceCursor({
        line: cursor.line,
        ch: lineUnderCursor.from.ch + left.length + firstPasted.length,
      });
    } else {
      const pos = lastInserted.getFirstLineContentStart();
      root.replaceCursor({
        line: pos.line,
        ch: pos.ch + restPasted[restPasted.length - 1].length,
      });
    }

    recalculateNumericBullets(root);
  }
}
