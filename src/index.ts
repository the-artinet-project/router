/**
 * Copyright 2025 The Artinet Project
 * SPDX-License-Identifier: Apache-2.0
 */
export { Model as o8 } from "./model.js";
export { create, type Params } from "./model.js";
export type { APIProvider } from "./model-util.js";
export { getHistory } from "./utils/history.js";
export { safeStdioTransport, safeClose } from "./utils/safeTransport.js";

import { Model as o8 } from "./model.js";
import { API } from "@artinet/types";
import { A2A } from "@artinet/sdk";
const orchestrator = await o8
  .create({
    modelId: "deepseek-r1",
    provider: (request) => {
      return Promise.resolve({
        agentResponse: "Hello, world!",
      } as API.ConnectResponse);
    },
  })
  .add({
    engine: async function* (context: A2A.Context) {
      yield {
        ...context.userMessage,
        role: "agent",
        parts: [{ kind: "text", text: "Hello, World!" }],
      };
    },
    agentCard: "HelloAgent",
  })
  .add({
    engine: async function* (context: A2A.Context) {
      yield {
        ...context.userMessage,
        role: "agent",
        parts: [{ kind: "text", text: "Goodbye, World!" }],
      };
    },
    agentCard: "GoodbyeAgent",
  });

await orchestrator.connect("What Agents are available to you?");
