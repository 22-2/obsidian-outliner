import esbuild from "esbuild";
import fs from "node:fs";

function hasArg(args, name) {
  return args.includes(name) || args.includes(`--${name}`);
}

const args = process.argv.slice(2);
const withTests = hasArg(args, "withTests") || hasArg(args, "with-tests");
const watch = hasArg(args, "watch") || args.includes("-w");

const pkg = JSON.parse(fs.readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const changelog = fs.readFileSync(new URL("../CHANGELOG.md", import.meta.url), "utf8");

const buildOptions = {
  entryPoints: [
    withTests
      ? "src/ObsidianOutlinerPluginWithTests.ts"
      : "src/ObsidianOutlinerPlugin.ts",
  ],
  outfile: "main.js",
  bundle: true,
  format: "cjs",
  platform: "browser",
  target: ["es6"],
  sourcemap: "inline",
  logLevel: "info",
  minify: !watch,
  external: [
    "obsidian",
    "codemirror",
    "@codemirror/state",
    "@codemirror/view",
    "@codemirror/language",
  ],
  define: {
    PLUGIN_VERSION: JSON.stringify(pkg.version),
    CHANGELOG_MD: JSON.stringify(changelog),
  },
  footer: {
    js: "\n// Obsidian loads plugins via CommonJS and expects `module.exports = PluginClass`.\n// esbuild emits `{ default: PluginClass }` for `export default`, so normalize here.\nif (module && module.exports && module.exports.default) module.exports = module.exports.default;\n",
  },
};

if (watch) {
  const ctx = await esbuild.context(buildOptions);
  await ctx.watch();
  console.log("[esbuild] watching...");
} else {
  await esbuild.build(buildOptions);
}
