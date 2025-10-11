import { jest, describe, it, expect } from "@jest/globals";
import { ConnectRequest } from "@artinet/types";
import { LocalRouter } from "../src/index.js";
import { RouterContextManager } from "../src/utils/context-manager.js";
import { echoAgentEngine } from "./agents/echo-agent.js";
import { testAgentCard } from "./agents/echo-agent.js";
jest.setTimeout(10000);
describe("Context Tests", () => {
  let request: ConnectRequest = {
    identifier:
      "0xf7dcee219e1a4027191508511c99ea64fe7202c71df416b5e5ed03cc2e6b386f",
    session: { messages: [{ role: "user", content: "test-message" }] },
    preferredEndpoint: "hf-inference",
    options: {
      isAuthRequired: false,
      isFallbackAllowed: false,
      params: {
        test: "test",
      },
      tools: {
        remoteServers: [],
        localServers: [],
        results: [],
      },
      agents: {
        localServers: [],
        remoteServers: [],
        responses: [],
      },
    },
  };

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
  }, 30000);
});
