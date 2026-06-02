import { mkdir, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const workspaceRoot = resolve(projectRoot, "..", "..");
const outputRoot = resolve(workspaceRoot, "dist");

const manifest = JSON.parse(
  await readFile(resolve(projectRoot, "manifest.json"), "utf8"),
);
const packageJson = JSON.parse(
  await readFile(resolve(projectRoot, "package.json"), "utf8"),
);

const safeName = packageJson.name.replace(/[^a-z0-9._-]+/gi, "-");
const outputPath = resolve(outputRoot, `${safeName}-${manifest.version}.ablx`);

await mkdir(outputRoot, { recursive: true });

const npmCli = process.env.npm_execpath;

if (!npmCli) {
  throw new Error("npm_execpath is not set. Run this script through npm run package.");
}

await run(process.execPath, [npmCli, "run", "build"]);
await run(process.execPath, [
  npmCli,
  "exec",
  "--",
  "extensions-cli",
  "package",
  "-o",
  outputPath
]);

console.log(`Packaged ${outputPath}`);

function run(command, args) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, {
      cwd: projectRoot,
      stdio: "inherit"
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolvePromise();
        return;
      }

      reject(new Error(`${command} ${args.join(" ")} exited with ${code}`));
    });
  });
}
