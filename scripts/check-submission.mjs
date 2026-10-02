import { readFile, readdir, stat, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
const roots = [
  ".gitignore",
  "index.html",
  "package.json",
  "package-lock.json",
  "tsconfig.json",
  "vite.config.js",
  "README.md",
  "DESIGN.md",
  "src",
  "public",
  "scripts",
  "dist",
  "artifacts",
];
const files = [];
async function walk(path) {
  const info = await stat(path);
  if (info.isDirectory()) {
    assert.ok(
      !["node_modules", ".cache", ".git", ".github"].includes(
        path.split("/").at(-1),
      ),
    );
    for (const entry of await readdir(path)) await walk(join(path, entry));
  } else {
    assert.ok(!/\.(tgz|map)$/.test(path));
    files.push({ path, bytes: info.size });
  }
}
for (const root of roots) await walk(root);
const html = await readFile("dist/index.html", "utf8");
for (const [, url] of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
  assert.ok(url.startsWith("./"), `Expected relative local asset: ${url}`);
  await stat(join("dist", url));
}
const cssFiles = files.filter(
  (f) => f.path.startsWith("dist/") && f.path.endsWith(".css"),
);
for (const f of cssFiles) {
  const css = await readFile(f.path, "utf8");
  for (const [, url] of css.matchAll(/url\(["']?([^"')]+)["']?\)/g)) {
    assert.ok(!url.startsWith("/") && !url.startsWith("http"));
    await stat(resolve(f.path, "..", url));
  }
}
const bytes = files.reduce((n, f) => n + f.bytes, 0);
assert.ok(bytes < 8388608 - 65536, `Submission too large: ${bytes}`);
assert.ok((await stat(".gitignore")).size <= 512);
assert.ok(
  !(await readFile(".gitignore", "utf8").then((s) =>
    s.split("\n").some((l) => /^\/?dist\/?$/.test(l)),
  )),
);
const hashes = {};
for (const f of files.filter((f) => f.path.startsWith("dist/")))
  hashes[f.path] = createHash("sha256")
    .update(await readFile(f.path))
    .digest("hex");
const report = {
  maximumBundleBytes: 8388608,
  deliveredFileBytes: bytes,
  reservedPackagingBytes: 65536,
  remainingAfterReserve: 8388608 - bytes - 65536,
  files: files.length,
  staticFileBytes: files
    .filter((f) => f.path.startsWith("dist/"))
    .reduce((n, f) => n + f.bytes, 0),
  ignoreFileBytes: (await stat(".gitignore")).size,
  relativeAssetChecks: "passed",
  distSha256: hashes,
  exclusions: [
    ".git/ (untouched)",
    ".github/ (untouched)",
    ".env files (untouched)",
    "node_modules/ (not created in repository)",
    "test/scratch/ (not delivered)",
    ".playwright-mcp/ (transient browser output)",
    ".imd/ (assignment input, not delivered)",
  ],
};
await writeFile(
  "artifacts/submission-results.json",
  JSON.stringify(report, null, 2) + "\n",
);
console.log(JSON.stringify(report, null, 2));
