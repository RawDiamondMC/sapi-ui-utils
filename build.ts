import * as esbuild from "esbuild";
import { execSync } from "node:child_process";
console.log(
  esbuild.buildSync({
    bundle: true,
    platform: "neutral",
    entryPoints: ["src/index.ts"],
    outfile: "src/index.js",
    external: ["@minecraft/server", "@minecraft/server-ui", "sapi-utils"],
    target: "es2023",
    minifySyntax: true,
    minifyWhitespace: true,
  }),
);
console.log(execSync("tsc", { encoding: "utf-8" }));
