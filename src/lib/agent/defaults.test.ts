import { describe, expect, it } from "vitest";
import { agentOptionsFromEnv } from "./defaults";

describe("agentOptionsFromEnv", () => {
  it("turns everything on by default", () => expect(agentOptionsFromEnv({})).toEqual({ retrieval: true, policy: true }));
  it("reads the ablation switches", () => {
    expect(agentOptionsFromEnv({ AGENT_RETRIEVAL: "off", AGENT_POLICY: "off" })).toEqual({ retrieval: false, policy: false });
  });
});
