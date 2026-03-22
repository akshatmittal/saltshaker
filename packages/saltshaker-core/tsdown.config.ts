import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["./src/index.ts"],
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
