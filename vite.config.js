import path from "node:path";
// The optional path lets constrained workers keep installed dependencies outside the repository.
const dependencyRoot = process.env.SURF_DEPENDENCIES;
export default {
  base: "./",
  resolve: dependencyRoot
    ? {
        alias: [
          {
            find: /^react-dom(\/.*)?$/,
            replacement: `${dependencyRoot}/react-dom$1`,
          },
          { find: /^react(\/.*)?$/, replacement: `${dependencyRoot}/react$1` },
          {
            find: /^viem$/,
            replacement: path.join(dependencyRoot, "viem/_esm/index.js"),
          },
          {
            find: /^viem\/chains$/,
            replacement: path.join(dependencyRoot, "viem/_esm/chains/index.js"),
          },
        ],
      }
    : {},
  build: { target: "es2022", sourcemap: false },
};
