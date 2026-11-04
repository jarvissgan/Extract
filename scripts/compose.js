// Runs Docker Compose, whether it's installed as the `docker compose` plugin
// (Docker Desktop) or the standalone `docker-compose` (e.g. Homebrew, Colima).
// Usage: node scripts/compose.js <compose args...>   e.g. node scripts/compose.js down
import { execFileSync, spawn } from "node:child_process";
import { pathToFileURL } from "node:url";

const works = (cmd, args) => {
  try {
    execFileSync(cmd, args, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
};

// Returns [command, leadingArgs], or throws with install/start instructions.
export function findCompose() {
  if (!works("docker", ["--version"])) {
    throw new Error("Docker isn't installed. Install Docker Desktop, or e.g. `brew install docker colima docker-compose`.");
  }
  if (!works("docker", ["info"])) {
    throw new Error("Docker isn't running. Start Docker Desktop (or run `colima start`) and try again.");
  }
  if (works("docker", ["compose", "version"])) return ["docker", ["compose"]];
  if (works("docker-compose", ["version"])) return ["docker-compose", []];
  throw new Error(
    "Docker Compose isn't installed. Install it with Docker Desktop, or `brew install docker-compose`."
  );
}

export function compose(args, env = process.env) {
  const [cmd, lead] = findCompose();
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, [...lead, ...args], {
      cwd: new URL("..", import.meta.url),
      stdio: "inherit",
      env,
    });
    child.on("error", reject);
    child.on("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`${cmd} ${[...lead, ...args].join(" ")} exited with ${code}`))
    );
  });
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  compose(process.argv.slice(2)).catch((err) => {
    console.error(`✖ ${err.message}`);
    process.exit(1);
  });
}
