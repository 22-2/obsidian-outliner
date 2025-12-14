import { makeEditor, makeRoot, makeSettings } from "../../__mocks__";
import { PasteContent } from "../PasteContent";

describe("PasteContent operation", () => {
  test("should paste single line into empty item", () => {
    const root = makeRoot({
      editor: makeEditor({
        text: "- \n",
        cursor: { line: 0, ch: 2 },
      }),
      settings: makeSettings(),
    });

    const op = new PasteContent(root, "Hello");
    op.perform();

    expect(root.print()).toBe("- Hello");
    expect(root.getCursor().line).toBe(0);
    expect(root.getCursor().ch).toBe(7);
  });

  test("should paste single line into non-empty item", () => {
     const root = makeRoot({
      editor: makeEditor({
        text: "- one two\n",
        cursor: { line: 0, ch: 6 },
      }),
      settings: makeSettings(),
    });

    const op = new PasteContent(root, " three");
    op.perform();

    expect(root.print()).toBe("- one threetwo");
    expect(root.getCursor().line).toBe(0);
    expect(root.getCursor().ch).toBe(11);
  });

  test("should split multiple lines into separate items", () => {
    const root = makeRoot({
      editor: makeEditor({
        text: "- first\n- last\n",
        cursor: { line: 0, ch: 4 }, // inside "first", after 'fi'
      }),
      settings: makeSettings(),
    });

    const op = new PasteContent(root, "rst line\nsecond line");
    op.perform();

    expect(root.print()).toBe("- first line\n- second linerst\n- last");
  });

  test("should remove leading hyphen list markers from pasted lines", () => {
    const root = makeRoot({
      editor: makeEditor({
        text: "- \n",
        cursor: { line: 0, ch: 2 },
      }),
      settings: makeSettings(),
    });

    const op = new PasteContent(root, "- item 1\n  - item 2\n-");
    op.perform();

    expect(root.print()).toBe("- item 1\n- item 2\n- ");
  });
  
  test("should trim whitespace from pasted lines", () => {
      const root = makeRoot({
      editor: makeEditor({
        text: "- \n",
        cursor: { line: 0, ch: 2 },
      }),
      settings: makeSettings(),
    });

    const op = new PasteContent(root, "  line 1\n   line 2");
    op.perform();

    expect(root.print()).toBe("- line 1\n- line 2");
  });

  test("should handle splitting correctly when pasting in middle of text", () => {
      const root = makeRoot({
      editor: makeEditor({
        text: "- start end\n",
        cursor: { line: 0, ch: 8 }, // "- start |end"
      }),
      settings: makeSettings(),
    });

    const op = new PasteContent(root, "middle\nnew item");
    op.perform();

    expect(root.print()).toBe("- start middle\n- new itemend");
     // "- start middle\n- new item|end"
    expect(root.getCursor().line).toBe(1);
    expect(root.getCursor().ch).toBe(10);
  });

  test("should paste multiple lines as sibling items", () => {
    const root = makeRoot({
      editor: makeEditor({
        text: "- item 1\n  - \n",
        cursor: { line: 1, ch: 4 },
      }),
      settings: makeSettings(),
    });

    const op = new PasteContent(root, "pasted 1\npasted 2\npasted 3");
    op.perform();

    expect(root.print()).toBe("- item 1\n  - pasted 1\n  - pasted 2\n  - pasted 3");
  });

  test("should paste content with empty lines as empty items", () => {
    const root = makeRoot({
      editor: makeEditor({
        text: "- item 1\n",
        cursor: { line: 0, ch: 8 },
      }),
      settings: makeSettings(),
    });

    const op = new PasteContent(root, "line 1\n\nline 2");
    op.perform();

    expect(root.print()).toBe("- item 1line 1\n- \n- line 2");
  });
});
