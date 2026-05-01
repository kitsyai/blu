#!/usr/bin/env node
import path from "node:path";
import { generateTypes, replayJournal, scaffoldNewApp } from "./index.js";

export async function runCli(argv: readonly string[]): Promise<number> {
  const [command, firstArg, ...rest] = argv;

  if (command === "new" && firstArg !== undefined) {
    await scaffoldNewApp({
      targetDir: firstArg,
      name: path.basename(firstArg),
    });
    return 0;
  }

  if (command === "replay" && firstArg !== undefined) {
    const options = readOptions(rest);
    const output = await replayJournal({
      journalPath: firstArg,
      projectionModulePath: options["projection-module"],
      outputPath: options.output,
    });
    process.stdout.write(output);
    return 0;
  }

  if (command === "types" && firstArg !== undefined) {
    const options = readOptions(rest);
    const output = await generateTypes({
      configPath: firstArg,
      registryModulePath: options["registry-module"],
      outputPath: options.output,
    });
    process.stdout.write(output);
    return 0;
  }

  process.stderr.write(
    [
      "Usage:",
      "  blu new <dir>",
      "  blu replay <journal.json> [--projection-module path] [--output path]",
      "  blu types <app-config.json> [--registry-module path] [--output path]",
      "",
    ].join("\n"),
  );
  return 1;
}

function readOptions(args: readonly string[]): Record<string, string> {
  const options: Record<string, string> = {};
  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];
    const next = args[index + 1];
    if (token === undefined || !token.startsWith("--") || next === undefined) {
      continue;
    }
    options[token.slice(2)] = next;
    index += 1;
  }
  return options;
}

const isMain =
  process.argv[1] !== undefined && import.meta.url.endsWith("/cli.js");
if (isMain) {
  const [, , ...argv] = process.argv;
  const code = await runCli(argv);
  process.exitCode = code;
}
