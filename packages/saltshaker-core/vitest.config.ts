import { readFileSync } from "node:fs";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    {
      name: "wgsl-loader",
      enforce: "pre",
      load(id) {
        if (id.endsWith(".wgsl")) {
          return `export default ${JSON.stringify(readFileSync(id, "utf8"))};`;
        }
      },
    },
  ],
  test: {
    environment: "node",
  },
});
