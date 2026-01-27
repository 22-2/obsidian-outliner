import { makeEditor, makeRoot, makeSettings } from "../../__mocks__";
import { InsertBlankLineAbove } from "../InsertBlankLineAbove";
import { InsertBlankLineBelow } from "../InsertBlankLineBelow";

describe("InsertBlankLine operations", () => {
  test("insert above basic", () => {
    const root = makeRoot({
      editor: makeEditor({
        text: "- item 1\n- item 2\n",
        cursor: { line: 1, ch: 2 },
      }),
      settings: makeSettings(),
    });

    const op = new InsertBlankLineAbove(root, "  ");
    op.perform();

    expect(root.print()).toBe("- item 1\n- \n- item 2");
    expect(root.getCursor().line).toBe(1);
    expect(root.getCursor().ch).toBe(2);
  });

  test("insert below basic", () => {
    const root = makeRoot({
      editor: makeEditor({
        text: "- item 1\n- item 2\n",
        cursor: { line: 0, ch: 2 },
      }),
      settings: makeSettings(),
    });

    const op = new InsertBlankLineBelow(root, "  ");
    op.perform();

    expect(root.print()).toBe("- item 1\n- \n- item 2");
    expect(root.getCursor().line).toBe(1);
    expect(root.getCursor().ch).toBe(2);
  });

  test("preserve checkbox prefix", () => {
    const root = makeRoot({
      editor: makeEditor({
        text: "- [ ] task 1\n- [ ] task 2\n",
        cursor: { line: 1, ch: 6 },
      }),
      settings: makeSettings(),
    });

    const op = new InsertBlankLineAbove(root, "  ");
    op.perform();

    expect(root.print()).toBe("- [ ] task 1\n- [ ] \n- [ ] task 2");
    expect(root.getCursor().line).toBe(1);
    expect(root.getCursor().ch).toBe(6);
  });

  test("do nothing for multiple selections", () => {
    const editor = makeEditor({
      text: "- item 1\n- item 2\n",
      cursor: { line: 0, ch: 2 },
    });

    editor.listSelections = () => [
      { anchor: { line: 0, ch: 3 }, head: { line: 0, ch: 3 } },
      { anchor: { line: 1, ch: 5 }, head: { line: 1, ch: 5 } },
    ];

    const root = makeRoot({ editor, settings: makeSettings() });

    const op = new InsertBlankLineAbove(root, "  ");
    op.perform();

    expect(root.print()).toBe("- item 1\n- item 2");
  });
});
