import fs from "node:fs";

import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

function wgslAsSource() {
  return {
    load(id: string) {
      if (!id.endsWith(".wgsl")) {
        return null;
      }

      return `export default ${JSON.stringify(fs.readFileSync(id, "utf8"))};`;
    },
    name: "wgsl-as-source",
  };
}

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  plugins: [
    devtools(),
    wgslAsSource(),
    tailwindcss(),
    tanstackStart({
      prerender: {
        autoSubfolderIndex: true,
        enabled: true,
        failOnError: true,
      },
    }),
    viteReact(),
  ],
});
