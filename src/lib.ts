import { readdir, readFile } from "fs/promises";
import * as path from "path";
import ts from "typescript";

type Layer = string;
type Path = string;

interface OnionConfig {
  layers: Layers;
  rules: Rule[];
}

interface Rule {
  from: Layer;
  allowedImports: Layer[];
}

interface Layers {
  [layer: Layer]: Path;
}

let hasErrors = false;

export function validateConfig(config: OnionConfig) {
  const { layers, rules } = config;
  const layerNames = Object.keys(layers);
  const ruleFromLayers = rules.map((rule) => rule.from);
  for (const rule of rules) {
    if (!layerNames.includes(rule.from)) {
      console.log(`Rule from layer ${rule.from} does not exist`);
      hasErrors = true;
      return;
    }
    for (const allowedImport of rule.allowedImports) {
      if (!layerNames.includes(allowedImport)) {
        console.log(
          `Rule from layer ${rule.from} allows import from non-existent layer ${allowedImport}`
        );
        hasErrors = true;
        return;
      }
    }
  }
  for (const layer of layerNames) {
    if (!ruleFromLayers.includes(layer)) {
      console.log(`Layer ${layer} has no rules`);
      hasErrors = true;
      return;
    }
  }
}

export async function findFileRecursive(
  dir: string,
  targetFile: string
): Promise<string | null> {
  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isFile() && entry.name === targetFile) {
      return fullPath;
    }

    if (entry.isDirectory()) {
      const found = await findFileRecursive(fullPath, targetFile);
      if (found) return found;
    }
  }

  return null;
}

export async function readConfig(): Promise<OnionConfig> {
  const fileName = "onion.config.json";
  const startDir = process.cwd();

  try {
    const configPath = await findFileRecursive(startDir, fileName);
    if (!configPath) {
      throw new Error(`❌ Could not find ${fileName}`);
    }
    console.log(`Using config ${configPath}`);
    const data = await readFile(configPath, "utf-8");
    const config = JSON.parse(data);
    validateConfig(config);
    return config;
  } catch (err) {
    throw new Error(`Failed to load config: ${err}`);
  }
}

export async function getTsFilesInLayer(
  layerPath: Path,
  baseDir: string
): Promise<Path[]> {
  const results: Path[] = [];

  const absoluteLayerPath = path.resolve(baseDir, layerPath);

  async function walk(dir: Path) {
    const entries = await readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (
        entry.isFile() &&
        entry.name.endsWith(".ts") &&
        !entry.name.endsWith(".d.ts")
      ) {
        results.push(fullPath);
      }
    }
  }

  await walk(absoluteLayerPath);
  return results;
}

interface ImportDetails {
  normalizedPath: Path;
  line: number;
  character: number;
};

export function getImportsInTsFile(tsFile: Path, baseDir: string): ImportDetails[] {
  const sourceCode = ts.sys.readFile(tsFile);
  if (!sourceCode) return [];

  const sourceFile = ts.createSourceFile(
    tsFile,
    sourceCode,
    ts.ScriptTarget.Latest,
    true
  );

  const imports: ImportDetails[] = [];

  sourceFile.forEachChild((node) => {
    if (
      ts.isImportDeclaration(node) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      const importPath = node.moduleSpecifier.text;

      if (!importPath.startsWith(".") && !importPath.startsWith("/")) return;

      const tsFileDir = path.dirname(tsFile);
      const absoluteImportPath = path.resolve(tsFileDir, importPath);
      const normalizedPath = path.relative(baseDir, absoluteImportPath);
      const line = ts.getLineAndCharacterOfPosition(
        sourceFile,
        node.moduleSpecifier.getStart()
      ).line;
      const character = ts.getLineAndCharacterOfPosition(
        sourceFile,
        node.moduleSpecifier.getStart()
      ).character;
      imports.push({
        normalizedPath,
        line,
        character
      });
    }
  });

  return imports;
}

export async function checkLayer(layer: Layer, config: OnionConfig, baseDir: string) {
  const layerPath = config.layers[layer];
  const tsFiles = await getTsFilesInLayer(layerPath, baseDir);
  const rule = config.rules.find((rule) => rule.from === layer);

  if (!rule) {
    console.warn(`No rules defined for layer ${layer}`);
    return;
  }

  for (const tsFile of tsFiles) {
    const imports = getImportsInTsFile(tsFile, baseDir);
    for (const imported of imports) {
      const importedLayer = Object.entries(config.layers).find(
        ([_, layerPath]) => {
          const resolvedPath = path.resolve(baseDir, layerPath);
          const absoluteImport = path.resolve(baseDir, imported.normalizedPath);
          return absoluteImport.startsWith(resolvedPath);
        }
      )?.[0];

      if (!importedLayer) {
        console.log(
          `❓ Could not determine layer for import path: ${imported} in ${tsFile}`
        );
        hasErrors = true;
        continue;
      }

      if (importedLayer === layer) {
        continue;
      }

      if (!rule.allowedImports.includes(importedLayer)) {
        const filePath = path.relative(baseDir, tsFile)  + ":" + imported.line + ":" + imported.character;
        const importPath = path.relative(baseDir, imported.normalizedPath) + ".ts";
        console.log(
          `❌ ${layer} (${filePath}) is importing from ${importedLayer} (${importPath})`
        );
        hasErrors = true;
      }
    }
  }
}

export async function checkLayers(config: OnionConfig, baseDir: string) {
  const layers = Object.keys(config.layers);
  for (const layer of layers) {
    await checkLayer(layer, config, baseDir);
  }
}

export async function main() {
  const config = await readConfig();
  const configPath = await findFileRecursive(
    process.cwd(),
    "onion.config.json"
  );

  if (!configPath) {
    throw new Error("Config file not found.");
  }

  const baseDir = path.dirname(configPath);
  await checkLayers(config, baseDir);

  if (hasErrors) {
    console.log("👎 Rotten 🧅");
    process.exit(1);
  } else {
    console.log("👍 Fresh 🧅");
    process.exit(0);
  }
}

(async () => {
  if (require.main === module) {
    await main();
  }
})();
