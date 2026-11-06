import { Settings, Storage } from "../Settings";

describe("Settings", () => {
  test("does not outdent empty items by default", async () => {
    const storage = {
      loadData: jest.fn().mockResolvedValue({}),
      saveData: jest.fn(),
    } as unknown as Storage;
    const settings = new Settings(storage);

    await settings.load();

    expect(settings.enterOutdentEmptyLastItem).toBe(false);
  });
});
