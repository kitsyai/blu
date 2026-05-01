import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import type { BluEvent, Projection, RouteState } from "@kitsy/blu-core";
import type { ApplicationConfiguration } from "@kitsy/blu-schema";
import { createSlate } from "@kitsy/blu-slate";
import {
  starterAppConfig,
  starterIndexHtml,
  starterMain,
  starterPackageJson,
  starterRegistry,
  starterRuntime,
  starterTsConfig,
  starterViteConfig,
} from "./templates.js";

export interface NewCommandOptions {
  targetDir: string;
  name?: string;
}

export interface ReplayCommandOptions {
  journalPath: string;
  projectionModulePath?: string;
  outputPath?: string;
}

export interface TypesCommandOptions {
  configPath: string;
  registryModulePath?: string;
  outputPath?: string;
}

export async function scaffoldNewApp(
  options: NewCommandOptions,
): Promise<void> {
  const targetDir = path.resolve(options.targetDir);
  const appName = options.name ?? path.basename(targetDir);

  await mkdir(path.join(targetDir, "src"), { recursive: true });
  await writeFile(
    path.join(targetDir, "package.json"),
    starterPackageJson(appName),
  );
  await writeFile(path.join(targetDir, "index.html"), starterIndexHtml);
  await writeFile(path.join(targetDir, "tsconfig.json"), starterTsConfig);
  await writeFile(path.join(targetDir, "vite.config.ts"), starterViteConfig);
  await writeFile(
    path.join(targetDir, "src", "app.config.ts"),
    starterAppConfig,
  );
  await writeFile(path.join(targetDir, "src", "registry.tsx"), starterRegistry);
  await writeFile(path.join(targetDir, "src", "runtime.tsx"), starterRuntime);
  await writeFile(path.join(targetDir, "src", "main.tsx"), starterMain);
}

export async function replayJournal(
  options: ReplayCommandOptions,
): Promise<string> {
  const journal = JSON.parse(
    await readFile(path.resolve(options.journalPath), "utf8"),
  ) as BluEvent[];
  const slate = createSlate();
  const projectionModule = await loadOptionalModule<{
    projections?: Projection<unknown>[];
  }>(options.projectionModulePath);
  const projections = projectionModule?.projections ?? [];

  for (const projection of projections) {
    slate.registerProjection(projection);
  }
  for (const event of journal) {
    await slate.append(event);
  }

  const result = {
    eventCount: journal.length,
    projections: Object.fromEntries(
      projections.map((projection) => [
        projection.name,
        slate.getProjection(projection.name),
      ]),
    ),
  };
  const serialized = JSON.stringify(result, null, 2);

  if (options.outputPath !== undefined) {
    await writeFile(path.resolve(options.outputPath), serialized);
  }
  return serialized;
}

export async function generateTypes(
  options: TypesCommandOptions,
): Promise<string> {
  const config = JSON.parse(
    await readFile(path.resolve(options.configPath), "utf8"),
  ) as ApplicationConfiguration;
  const registryModule = await loadOptionalModule<{
    componentUrns?: string[];
    registryEntries?: Array<{ urn: string }>;
  }>(options.registryModulePath);

  const componentUrns =
    registryModule?.componentUrns ??
    registryModule?.registryEntries?.map((entry) => entry.urn) ??
    [];
  const eventTypes = (config.eventRegistry ?? []).map((event) => event.type);

  const contents = [
    "export type BluRegisteredEventType =",
    eventTypes.length === 0
      ? "  never;"
      : `  ${eventTypes.map((type) => JSON.stringify(type)).join(" | ")};`,
    "",
    "export type BluRegisteredComponentUrn =",
    componentUrns.length === 0
      ? "  never;"
      : `  ${componentUrns.map((urn) => JSON.stringify(urn)).join(" | ")};`,
    "",
    "export interface BluCurrentRoute extends RouteState {}",
    "",
  ].join("\n");

  const withImport =
    'import type { RouteState } from "@kitsy/blu-core";\n\n' + contents;

  if (options.outputPath !== undefined) {
    await writeFile(path.resolve(options.outputPath), withImport);
  }
  return withImport;
}

async function loadOptionalModule<T>(
  modulePath: string | undefined,
): Promise<T | null> {
  if (modulePath === undefined) {
    return null;
  }
  const imported = await import(pathToFileURL(path.resolve(modulePath)).href);
  return imported as T;
}
