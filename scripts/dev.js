import { spawn } from "node:child_process";
import { platform } from "node:os";

const isWindows = platform() === "win32";
const npmCommand = isWindows ? "npm.cmd" : "npm";
const children = [];
let stopping = false;
let exitCode = 0;

function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  exitCode = code;

  for (const child of children) {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill("SIGTERM");
    }
  }
}

function start(label, args) {
  const child = spawn(npmCommand, args, {
    stdio: "inherit",
    shell: isWindows,
    windowsHide: true,
  });
  children.push(child);

  child.on("error", (error) => {
    console.error(`Could not start ${label}: ${error.message}`);
    stop(1);
  });

  child.on("exit", (code, signal) => {
    if (stopping) return;
    console.log(`${label} stopped${signal ? ` after ${signal}` : ""}.`);
    stop(code ?? 1);
  });

  return child;
}

console.log("Starting the API and frontend. Press Ctrl+C to stop both.");
start("API", ["run", "dev:server"]);
start("Frontend", ["run", "dev"]);

process.on("SIGINT", () => stop(130));
process.on("SIGTERM", () => stop(143));
process.on("exit", () => {
  process.exitCode = exitCode;
});
