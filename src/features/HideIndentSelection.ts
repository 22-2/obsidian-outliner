import { Plugin } from "obsidian";

import { StateEffect, StateField } from "@codemirror/state";
import { EditorView, ViewPlugin } from "@codemirror/view";

import { Feature } from "./Feature";

import { Settings } from "../services/Settings";

const CLASS_NAME = "outliner-hide-indent-selection";

export class HideIndentSelection implements Feature {
  constructor(
    private plugin: Plugin,
    private settings: Settings,
  ) {}

  async load() {
    const settings = this.settings;
    const setEnabled = StateEffect.define<boolean>();
    const enabled = StateField.define<boolean>({
      create: () => settings.hideIndentSelection,
      update(value, tr) {
        for (const effect of tr.effects) {
          if (effect.is(setEnabled)) value = effect.value;
        }
        return value;
      },
    });
    this.plugin.registerEditorExtension([
      enabled,
      EditorView.editorAttributes.compute([enabled], (state) =>
        state.field(enabled) ? { class: CLASS_NAME } : {},
      ),
      ViewPlugin.define((view: EditorView) => {
        const update = () => {
          if (view.state.field(enabled) !== settings.hideIndentSelection) {
            view.dispatch({
              effects: setEnabled.of(settings.hideIndentSelection),
            });
          }
        };
        settings.onChange(update);
        return {
          destroy() {
            settings.removeCallback(update);
          },
        };
      }),
    ]);
  }

  async unload() {}
}
