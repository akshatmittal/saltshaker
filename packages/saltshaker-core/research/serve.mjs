import { realpathSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const vitestDirectory = realpathSync(resolve(root, "../node_modules/vitest"));
const viteEntry = resolve(vitestDirectory, "../vite/dist/node/index.js");
const { createServer } = await import(pathToFileURL(viteEntry).href);

const server = await createServer({
  root,
  server: {
    // An edit must not cancel a long shader compilation or parameter sweep.
    hmr: false,
    fs: {
      allow: [resolve(root, "../../..")],
    },
  },
});

await server.listen();
server.printUrls();
