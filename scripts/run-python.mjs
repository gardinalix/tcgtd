import { spawn } from "node:child_process";

const args = process.argv.slice(2);
const candidates = process.env.PYTHON ? [[process.env.PYTHON, args]] : process.platform === "win32"
  ? [["py", ["-3", ...args]], ["python", args]]
  : [["python3", args], ["python", args]];

for (const [index, [executable, executableArgs]] of candidates.entries()) {
  const code = await new Promise((resolve, reject) => {
    const child = spawn(executable, executableArgs, { stdio: "inherit", shell: false });
    child.once("error", (error) => error.code === "ENOENT" ? resolve(null) : reject(error));
    child.once("exit", (exitCode) => resolve(exitCode ?? 1));
  });
  if (code !== null) {
    process.exitCode = code;
    break;
  }
  if (index === candidates.length - 1) throw new Error("Python was not found. Install Python or set PYTHON.");
}
