/* eslint-disable @typescript-eslint/no-require-imports -- This dependency-free fixture runner installs a temporary TypeScript require hook. */
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..");
const sourceRoot = path.join(projectRoot, "src");
const originalResolveFilename = Module._resolveFilename;

Module._resolveFilename = function resolveFilename(
  request,
  parent,
  isMain,
  options,
) {
  const resolvedRequest = request.startsWith("@/")
    ? path.join(sourceRoot, request.slice(2))
    : request;

  return originalResolveFilename.call(
    this,
    resolvedRequest,
    parent,
    isMain,
    options,
  );
};

require.extensions[".ts"] = function loadTypeScript(module, filename) {
  const source = fs.readFileSync(filename, "utf8");
  const compiled = ts.transpileModule(source, {
    fileName: filename,
    compilerOptions: {
      esModuleInterop: true,
      module: ts.ModuleKind.CommonJS,
      moduleResolution: ts.ModuleResolutionKind.Node10,
      target: ts.ScriptTarget.ES2022,
    },
  });

  module._compile(compiled.outputText, filename);
};

const { runValidationPlanCoverageFixtures } = require(
  path.join(
    sourceRoot,
    "lib",
    "validations",
    "validation-plan-coverage.fixtures.ts",
  ),
);

const result = runValidationPlanCoverageFixtures();

process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
