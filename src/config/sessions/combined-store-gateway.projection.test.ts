import { expect, it } from "vitest";
import { withOpenClawTestState } from "../../test-utils/openclaw-test-state.js";
import type { OpenClawConfig } from "../types.openclaw.js";
import { loadCombinedSessionStoreForGatewayCore } from "./combined-store-gateway.js";
import { replaceSessionEntrySync } from "./session-accessor.js";
import type { SessionEntry } from "./types.js";

// Ported from upstream a1a50976b9 onto 2026.8.2 (0965053) — the release the
// Waygent dev box runs. Store-wide reads must not materialize saved prompts.
it("omits retained prompt payloads unless a caller opts into the full projection", async () => {
  await withOpenClawTestState({ label: "combined-store-projection" }, async () => {
    const cfg: OpenClawConfig = { agents: { entries: { main: {} } } };

    replaceSessionEntrySync({ agentId: "main", sessionKey: "agent:main:main" }, {
      sessionId: "prompt-payload-session",
      updatedAt: 7,
      skillsSnapshot: { prompt: "skill prompt body", skills: [{ name: "example" }] },
      systemPromptReport: {
        source: "run",
        generatedAt: 7,
        systemPrompt: { chars: 17, projectContextChars: 0, nonProjectContextChars: 17 },
        injectedWorkspaceFiles: [],
        skills: { promptChars: 17, entries: [{ name: "example", blockChars: 17 }] },
        tools: { listChars: 0, schemaChars: 0, entries: [] },
      },
    } as unknown as SessionEntry);

    // Default: metadata resolves, payloads stripped.
    const defaultEntry = loadCombinedSessionStoreForGatewayCore(cfg).store["agent:main:main"];
    expect.soft(defaultEntry?.sessionId).toBe("prompt-payload-session");
    expect.soft(defaultEntry?.skillsSnapshot).toBeUndefined();
    expect.soft(defaultEntry?.systemPromptReport).toBeUndefined();

    // Explicit opt-in still gets the payloads — this is what contextWeight rides on.
    const fullEntry = loadCombinedSessionStoreForGatewayCore(cfg, { projection: "full" }).store[
      "agent:main:main"
    ];
    expect.soft(fullEntry?.skillsSnapshot?.prompt).toBe("skill prompt body");
    expect(fullEntry?.systemPromptReport?.systemPrompt.chars).toBe(17);
  });
});
