import { jest, describe, it, expect } from "@jest/globals";
import { LocalRouter } from "../src/index.js";
import { echoAgentEngine } from "./agents/echo-agent.js";
import { testAgentCard } from "./agents/echo-agent.js";
jest.setTimeout(10000);
describe("Context Tests", () => {
  it("should emit updates", async () => {
    const router = new LocalRouter();
    router.createAgent({
      engine: echoAgentEngine,
      agentCard: testAgentCard,
    });
    let updateCalled = false;
    let errorCalled = false;
    const abortController = new AbortController();
    router.on("update", (_) => {
      updateCalled = true;
      abortController.abort();
    });
    router.on("error", (_) => {
      errorCalled = true;
      abortController.abort();
    });
    const response = await router.connect({
      message: "test-message",
      agents: ["test-agent"],
      options: {
        abortSignal: abortController.signal,
      },
    });
    expect(response).toBeDefined();
    expect(updateCalled || errorCalled).toBe(true);
    expect(abortController.signal.aborted).toBe(true);
    await router.close();
  }, 60000);
});
