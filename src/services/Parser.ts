import { Logger } from "./Logger";
import { Settings } from "./Settings";

import { List, Root } from "../root";
import { checkboxRe } from "../utils/checkboxRe";

const bulletSignRe = `(?:[-*+]|\\d+\\.)`;
const optionalCheckboxRe = `(?:${checkboxRe})?`;

export interface ReaderPosition {
  line: number;
  ch: number;
}

export interface ReaderSelection {
  anchor: ReaderPosition;
  head: ReaderPosition;
}

export interface Reader {
  getCursor(): ReaderPosition;
  getLine(n: number): string;
  lastLine(): number;
  listSelections(): ReaderSelection[];
  getAllFoldedLines(): number[];
  getValue?(): string; // For cache invalidation
}

interface ParseListList {
  getFirstLineIndent(): string;
  setNotesIndent(notesIndent: string): void;
  getNotesIndent(): string | null;
  addLine(text: string): void;
  getParent(): ParseListList | null;
  addAfterAll(list: ParseListList): void;
}

interface ParseCache {
  root: Root;
  contentHash: string;
  timestamp: number;
}

export class Parser {
  // Pre-compiled regexes for better performance
  private static readonly COMPILED_REGEXES = {
    listItemWithoutSpaces: new RegExp(`^${bulletSignRe}( |\t)`),
    listItem: new RegExp(`^[ \t]*${bulletSignRe}( |\t)`),
    stringWithSpaces: new RegExp(`^[ \t]+`),
    parseListItem: new RegExp(
      `^([ \t]*)(${bulletSignRe})( |\t)(${optionalCheckboxRe})(.*)`,
    ),
  };

  // Cache for parsed results
  private parseCache = new Map<string, ParseCache>();
  private readonly CACHE_MAX_SIZE = 100;
  private readonly CACHE_MAX_AGE = 5000; // 5 seconds

  constructor(
    private logger: Logger,
    private settings: Settings,
  ) {}

  parseRange(editor: Reader, fromLine = 0, toLine = editor.lastLine()): Root[] {
    const lists: Root[] = [];

    for (let i = fromLine; i <= toLine; i++) {
      const line = editor.getLine(i);

      if (i === fromLine || this.isListItem(line)) {
        const list = this.parseWithLimits(editor, i, fromLine, toLine);

        if (list) {
          lists.push(list);
          i = list.getContentEnd().line;
        }
      }
    }

    return lists;
  }

  parse(editor: Reader, cursor = editor.getCursor()): Root | null {
    // Try to get from cache first
    const cached = this.getCachedParse(editor, cursor);
    if (cached) {
      return cached;
    }

    const root = this.parseWithLimits(editor, cursor.line, 0, editor.lastLine());

    // Cache the result
    if (root) {
      this.setCachedParse(editor, cursor, root);
    }

    return root;
  }

  // Parse only around cursor for better performance
  parseAroundCursor(
    editor: Reader,
    cursor = editor.getCursor(),
    range = 100,
  ): Root | null {
    const fromLine = Math.max(0, cursor.line - range);
    const toLine = Math.min(editor.lastLine(), cursor.line + range);

    return this.parseWithLimits(editor, cursor.line, fromLine, toLine);
  }

  // Clear cache when needed
  clearCache(): void {
    this.parseCache.clear();
  }

  private getCachedParse(editor: Reader, cursor: ReaderPosition): Root | null {
    // Clean old cache entries
    this.cleanOldCache();

    const cacheKey = this.getCacheKey(cursor);
    const cached = this.parseCache.get(cacheKey);

    if (!cached) {
      return null;
    }

    // Validate cache with content hash
    const currentHash = this.getContentHash(editor, cursor);
    if (cached.contentHash !== currentHash) {
      this.parseCache.delete(cacheKey);
      return null;
    }

    return cached.root;
  }

  private setCachedParse(
    editor: Reader,
    cursor: ReaderPosition,
    root: Root,
  ): void {
    // Limit cache size
    if (this.parseCache.size >= this.CACHE_MAX_SIZE) {
      const firstKey = this.parseCache.keys().next().value;
      this.parseCache.delete(firstKey);
    }

    const cacheKey = this.getCacheKey(cursor);
    const contentHash = this.getContentHash(editor, cursor);

    this.parseCache.set(cacheKey, {
      root,
      contentHash,
      timestamp: Date.now(),
    });
  }

  private getCacheKey(cursor: ReaderPosition): string {
    // Include both line and ch to avoid cache collision when cursor moves on same line
    return `${cursor.line}:${cursor.ch}`;
  }

  private getContentHash(editor: Reader, cursor: ReaderPosition): string {
    // Hash based on surrounding lines for quick validation
    const range = 5;
    const fromLine = Math.max(0, cursor.line - range);
    const toLine = Math.min(editor.lastLine(), cursor.line + range);

    let hash = `${cursor.line}:${cursor.ch}|`;
    for (let i = fromLine; i <= toLine; i++) {
      hash += editor.getLine(i) + "\n";
    }

    // Simple hash function
    let hashValue = 0;
    for (let i = 0; i < hash.length; i++) {
      const char = hash.charCodeAt(i);
      hashValue = (hashValue << 5) - hashValue + char;
      hashValue = hashValue & hashValue; // Convert to 32bit integer
    }

    return hashValue.toString(36);
  }

  private cleanOldCache(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [key, value] of this.parseCache.entries()) {
      if (now - value.timestamp > this.CACHE_MAX_AGE) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      this.parseCache.delete(key);
    }
  }

  private parseWithLimits(
    editor: Reader,
    parsingStartLine: number,
    limitFrom: number,
    limitTo: number,
  ): Root | null {
    const d = this.logger.bind("parseList");
    const error = (msg: string): null => {
      d(msg);
      return null;
    };

    const line = editor.getLine(parsingStartLine);

    let listLookingPos: number | null = null;

    if (this.isListItem(line)) {
      listLookingPos = parsingStartLine;
    } else if (this.isLineWithIndent(line)) {
      let listLookingPosSearch = parsingStartLine - 1;
      while (listLookingPosSearch >= 0) {
        const line = editor.getLine(listLookingPosSearch);
        if (this.isListItem(line)) {
          listLookingPos = listLookingPosSearch;
          break;
        } else if (this.isLineWithIndent(line)) {
          listLookingPosSearch--;
        } else {
          break;
        }
      }
    }

    if (listLookingPos === null) {
      return null;
    }

    let listStartLine: number | null = null;
    let listStartLineLookup = listLookingPos;
    while (listStartLineLookup >= 0) {
      const line = editor.getLine(listStartLineLookup);
      if (!this.isListItem(line) && !this.isLineWithIndent(line)) {
        break;
      }
      if (this.isListItemWithoutSpaces(line)) {
        listStartLine = listStartLineLookup;
        if (listStartLineLookup <= limitFrom) {
          break;
        }
      }
      listStartLineLookup--;
    }

    if (listStartLine === null) {
      return null;
    }

    let listEndLine = listLookingPos;
    let listEndLineLookup = listLookingPos;
    while (listEndLineLookup <= editor.lastLine()) {
      const line = editor.getLine(listEndLineLookup);
      if (!this.isListItem(line) && !this.isLineWithIndent(line)) {
        break;
      }
      if (!this.isEmptyLine(line)) {
        listEndLine = listEndLineLookup;
      }
      if (listEndLineLookup >= limitTo) {
        listEndLine = limitTo;
        break;
      }
      listEndLineLookup++;
    }

    if (listStartLine > parsingStartLine || listEndLine < parsingStartLine) {
      return null;
    }

    // if the last line contains only spaces and that's incorrect indent, then ignore the last line
    // https://github.com/vslinko/obsidian-outliner/issues/368
    if (listEndLine > listStartLine) {
      const lastLine = editor.getLine(listEndLine);
      if (lastLine.trim().length === 0) {
        const prevLine = editor.getLine(listEndLine - 1);
        const [, prevLineIndent] = /^(\s*)/.exec(prevLine);
        if (!lastLine.startsWith(prevLineIndent)) {
          listEndLine--;
        }
      }
    }

    const root = new Root(
      { line: listStartLine, ch: 0 },
      { line: listEndLine, ch: editor.getLine(listEndLine).length },
      editor.listSelections().map((r) => ({
        anchor: { line: r.anchor.line, ch: r.anchor.ch },
        head: { line: r.head.line, ch: r.head.ch },
      })),
    );

    let currentParent: ParseListList = root.getRootList();
    let currentList: ParseListList | null = null;
    let currentIndent = "";

    const foldedLines = editor.getAllFoldedLines();

    for (let l = listStartLine; l <= listEndLine; l++) {
      const line = editor.getLine(l);
      const matches = Parser.COMPILED_REGEXES.parseListItem.exec(line);

      if (matches) {
        const [, indent, bullet, spaceAfterBullet] = matches;
        let [, , , , optionalCheckbox, content] = matches;

        content = optionalCheckbox + content;
        if (this.settings.keepCursorWithinContent !== "bullet-and-checkbox") {
          optionalCheckbox = "";
        }

        const compareLength = Math.min(currentIndent.length, indent.length);
        const indentSlice = indent.slice(0, compareLength);
        const currentIndentSlice = currentIndent.slice(0, compareLength);

        if (indentSlice !== currentIndentSlice) {
          const expected = currentIndentSlice
            .replace(/ /g, "S")
            .replace(/\t/g, "T");
          const got = indentSlice.replace(/ /g, "S").replace(/\t/g, "T");

          return error(
            `Unable to parse list: expected indent "${expected}", got "${got}"`,
          );
        }

        if (indent.length > currentIndent.length) {
          currentParent = currentList;
          currentIndent = indent;
        } else if (indent.length < currentIndent.length) {
          while (
            currentParent.getFirstLineIndent().length >= indent.length &&
            currentParent.getParent()
          ) {
            currentParent = currentParent.getParent();
          }
          currentIndent = indent;
        }

        const foldRoot = foldedLines.includes(l);

        currentList = new List(
          root,
          indent,
          bullet,
          optionalCheckbox,
          spaceAfterBullet,
          content,
          foldRoot,
        );
        currentParent.addAfterAll(currentList);
      } else if (this.isLineWithIndent(line)) {
        if (!currentList) {
          return error(
            `Unable to parse list: expected list item, got empty line`,
          );
        }

        const indentToCheck = currentList.getNotesIndent() || currentIndent;

        if (line.indexOf(indentToCheck) !== 0) {
          const expected = indentToCheck.replace(/ /g, "S").replace(/\t/g, "T");
          const got = line
            .match(/^[ \t]*/)[0]
            .replace(/ /g, "S")
            .replace(/\t/g, "T");

          return error(
            `Unable to parse list: expected indent "${expected}", got "${got}"`,
          );
        }

        if (!currentList.getNotesIndent()) {
          const matches = line.match(/^[ \t]+/);

          if (!matches || matches[0].length <= currentIndent.length) {
            if (/^\s+$/.test(line)) {
              continue;
            }

            return error(
              `Unable to parse list: expected some indent, got no indent`,
            );
          }

          currentList.setNotesIndent(matches[0]);
        }

        currentList.addLine(line.slice(currentList.getNotesIndent().length));
      } else {
        return error(
          `Unable to parse list: expected list item or note, got "${line}"`,
        );
      }
    }

    return root;
  }

  private isEmptyLine(line: string) {
    return line.length === 0;
  }

  private isLineWithIndent(line: string) {
    return Parser.COMPILED_REGEXES.stringWithSpaces.test(line);
  }

  private isListItem(line: string) {
    return Parser.COMPILED_REGEXES.listItem.test(line);
  }

  private isListItemWithoutSpaces(line: string) {
    return Parser.COMPILED_REGEXES.listItemWithoutSpaces.test(line);
  }
}
