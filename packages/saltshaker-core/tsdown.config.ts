import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["./src/index.ts"],
  loader: {
    ".wgsl": "text",
  },
  deps: {
    neverBundle: ["viem"],
    alwaysBundle: [],
  },
  format: ["esm"],
  dts: {
    enabled: true,
    eager: true,
  },
  minify: true,
});
