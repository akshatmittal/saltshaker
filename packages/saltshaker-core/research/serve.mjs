import { execFileSync } from "node:child_process";
import { realpathSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const vitestDirectory = realpathSync(resolve(root, "../node_modules/vitest"));
const viteEntry = resolve(vitestDirectory, "../vite/dist/node/index.js");
const { createServer } = await import(pathToFileURL(viteEntry).href);

const server = await createServer({
  root,
  plugins: [
    {
      name: "frozen-research-baseline",
      configureServer(server) {
        const paths = {
          "/baseline.wgsl": "packages/saltshaker-core/src/gpu/shaders/common/core.wgsl",
          "/baseline-createx.wgsl": "packages/saltshaker-core/src/gpu/shaders/protocols/createx.wgsl",
        };
        server.middlewares.use((request, response, next) => {
          const pathname = request.url?.split("?")[0];
          const source = Object.hasOwn(paths, pathname) ? paths[pathname] : undefined;
          if (!source || existsSync(resolve(root, `.${pathname}`))) return next();
          try {
            const baseline = execFileSync("git", ["show", `06445c5712df561e95fefc89499317619ae97dbe:${source}`], {
              cwd: root,
              encoding: "utf8",
              stdio: ["ignore", "pipe", "pipe"],
            });
            response.setHeader("Content-Type", "text/plain; charset=utf-8");
            response.end(baseline);
          } catch {
            response.statusCode = 503;
            response.end(
              "Baseline revision unavailable. Fetch full Git history or freeze a baseline as described in research/README.md.",
            );
          }
        });
      },
    },
  ],
  server: {
    host: "0.0.0.0",
    port: 5173,
    strictPort: true,
    allowedHosts: [".onamp.dev"],
    // An edit must not cancel a long shader compilation or parameter sweep.
    hmr: false,
    fs: {
      allow: [resolve(root, "../../..")],
    },
  },
});

await server.listen();
server.printUrls();
