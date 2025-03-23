import { exec } from "child_process";
import { promisify } from "util";
import * as path from "path";

const execAsync = promisify(exec);

function normalizeOutput(output: string, projectRoot: string): string {
  return output.replace(new RegExp(projectRoot, "g"), "<PROJECT_ROOT>").trim();
}

describe("fresh-onion", () => {
  const projectRoot = path.resolve(__dirname, "..");

  it("fresh", async () => {
    const cwd = path.join(projectRoot, "demos/fresh");

    const { stdout } = await execAsync(`npx c8 --report-dir=coverage/subprocess ts-node ../../src/index.ts`, { cwd });

    const normalized = normalizeOutput(stdout, projectRoot);

    expect(normalized).toContain("Using config <PROJECT_ROOT>/demos/fresh/onion.config.json");
    expect(normalized).toContain("👍 Fresh 🧅");
  });

  it("rotten", async () => {
    const cwd = path.join(projectRoot, "demos/rotten");

    try {
      await execAsync(`npx c8 --report-dir=coverage/subprocess ts-node ../../src/index.ts`, { cwd });
      throw new Error("Expected command to fail with rotten onion");
    } catch (err: any) {
      const output = err.stdout || err.stderr || "";
      const normalized = normalizeOutput(output, projectRoot);

      expect(normalized).toContain(
        'Using config <PROJECT_ROOT>/demos/rotten/onion.config.json'
      );
      expect(normalized).toContain(
        `❌ \"app-services\" is importing from \"infrastructure\" via \"<PROJECT_ROOT>/demos/rotten/src/infrastructure/storage/some-repository-imp.ts\"`
      );
      expect(normalized).toContain("👎 Rotten 🧅");
    }
  });
});
