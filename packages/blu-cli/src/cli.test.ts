import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { runCli } from "./cli.js";
import { generateTypes, replayJournal, scaffoldNewApp } from "./index.js";

describe("@kitsy/blu-cli", () => {
  it("scaffolds a runnable starter application", async () => {
    const targetDir = await mkdtemp(path.join(os.tmpdir(), "blu-new-"));
    await scaffoldNewApp({ targetDir, name: "demo-starter" });

    const packageJson = JSON.parse(
      await readFile(path.join(targetDir, "package.json"), "utf8"),
    ) as { scripts: Record<string, string> };
    const main = await readFile(path.join(targetDir, "src", "main.tsx"), "utf8");

    expect(packageJson.scripts.dev).toBe("vite");
    expect(main).toContain("BluRouteShellApp");
  });

  it("replays a journal dump through supplied projections", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "blu-replay-"));
    const journalPath = path.join(tempDir, "journal.json");
    const projectionPath = path.join(tempDir, "projections.mjs");

    await writeFile(
      journalPath,
      JSON.stringify([
        {
          eventId: "01",
          type: "counter:incremented",
          schemaVersion: 1,
          class: "fact",
          durability: "journaled",
          payload: { amount: 2 },
          emitter: "urn:test",
          scopePath: "app",
          origin: "user",
          causationId: null,
          correlationId: "01",
          timestamp: 1,
          sequence: 0,
        },
      ]),
    );
    await writeFile(
      projectionPath,
      `export const projections = [{
        name: "count",
        authority: "projection-authoritative",
        initialState: 0,
        reduce: (state, event) => event.type === "counter:incremented" ? state + event.payload.amount : state
      }];`,
    );

    const output = JSON.parse(
      await replayJournal({
        journalPath,
        projectionModulePath: projectionPath,
      }),
    ) as { projections: { count: number } };

    expect(output.projections.count).toBe(2);
  });

  it("generates event and component type declarations", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "blu-types-"));
    const configPath = path.join(tempDir, "app-config.json");
    const registryPath = path.join(tempDir, "registry.mjs");

    await writeFile(
      configPath,
      JSON.stringify({
        id: "demo",
        name: "Demo",
        version: "1.0.0",
        entry: { ref: "urn:app:view:home" },
        eventRegistry: [
          {
            type: "router:navigated",
            defaultClass: "fact",
            defaultDurability: "observable",
            schemaVersion: 1,
          },
        ],
      }),
    );
    await writeFile(
      registryPath,
      `export const componentUrns = ["urn:blu:ui:text", "urn:blu:ui:button"];`,
    );

    const declarations = await generateTypes({
      configPath,
      registryModulePath: registryPath,
    });

    expect(declarations).toContain('"router:navigated"');
    expect(declarations).toContain('"urn:blu:ui:button"');
  });

  it("parses cli commands through runCli", async () => {
    const targetDir = await mkdtemp(path.join(os.tmpdir(), "blu-run-"));
    const code = await runCli(["new", targetDir]);
    expect(code).toBe(0);
    expect(await readFile(path.join(targetDir, "src", "runtime.tsx"), "utf8")).toContain(
      "BluShell",
    );
  });
});
