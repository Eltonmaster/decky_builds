// Bundles the browser preview: the real plugin UI with @decky/ui and @decky/api swapped for stubs.
import { build } from "esbuild";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
const here = dirname(fileURLToPath(import.meta.url));
await build({
  entryPoints: [join(here, "main.tsx")],
  bundle: true,
  format: "esm",
  target: "es2022",
  outfile: join(here, "bundle.js"),
  jsx: "automatic",
  define: { __DECKY_BUILDS_MOCK__: "true", "process.env.NODE_ENV": '"development"' },
  alias: {
    "@decky/ui": join(here, "decky-ui-stub.tsx"),
    "@decky/api": join(here, "decky-api-stub.ts"),
  },
  loader: { ".json": "json" },
  logLevel: "warning",
});
console.log("preview built:", join(here, "index.html"));
