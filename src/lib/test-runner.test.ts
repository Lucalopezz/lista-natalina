import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { expect, test } from "vitest";

test("runner não remove container alheio quando a criação falha", () => {
  const directory = mkdtempSync(join(tmpdir(), "lista-runner-"));
  try {
    const calls = join(directory, "calls");
    // Simula uma colisão de nome sem iniciar Docker nem acessar qualquer banco.
    // O comando run falha; stop/rm sobre o mesmo nome apagariam recurso alheio.
    writeFileSync(join(directory, "docker"), '#!/bin/sh\nprintf "%s\\n" "$1" >> "$RUNNER_CALLS"\nif [ "$1" = run ]; then exit 1; fi\n', { mode: 0o700 });
    const result = spawnSync("bash", [resolve("scripts/test-auth.sh"), "integration"], {
      env: { ...process.env, PATH: `${directory}:${process.env.PATH}`, RUNNER_CALLS: calls },
      encoding: "utf8", timeout: 5000,
    });
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(1);
    expect(readFileSync(calls, "utf8").trim().split("\n")).toEqual(["run"]);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
