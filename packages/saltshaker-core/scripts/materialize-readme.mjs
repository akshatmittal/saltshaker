import { copyFileSync, existsSync, lstatSync, readlinkSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const readmePath = resolve(packageDir, "README.md");
const markerPath = resolve(packageDir, ".readme-symlink-target");

if (!existsSync(readmePath)) {
  throw new Error(`README not found at ${readmePath}`);
}

const stats = lstatSync(readmePath);
if (!stats.isSymbolicLink()) {
  process.exit(0);
}

const target = readlinkSync(readmePath);
const resolvedTarget = resolve(packageDir, target);

rmSync(readmePath);
copyFileSync(resolvedTarget, readmePath);
writeFileSync(markerPath, `${target}\n`, "utf8");
