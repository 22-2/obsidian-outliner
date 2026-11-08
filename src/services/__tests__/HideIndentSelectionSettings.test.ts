import { Settings } from "../Settings";

test("indent selection color is opt-in and persists", async () => {
  let saved = {};
  const storage = {
    loadData: async () => saved as ReturnType<Settings["getValues"]>,
    saveData: async (value: ReturnType<Settings["getValues"]>) => {
      saved = { ...value };
    },
  };
  const settings = new Settings(storage);
  await settings.load();
  expect(settings.hideIndentSelection).toBe(false);

  settings.hideIndentSelection = true;
  await settings.save();
  const reloaded = new Settings(storage);
  await reloaded.load();
  expect(reloaded.hideIndentSelection).toBe(true);
  reloaded.reset();
  expect(reloaded.hideIndentSelection).toBe(false);
});
