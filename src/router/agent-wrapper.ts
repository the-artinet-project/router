/**
 * Copyright 2025 The Artinet Project
 * SPDX-License-Identifier: Apache-2.0
 */
import {
  Agent,
  AgentBuilder,
  AgentCard,
  AgentSkill,
  createAgent,
  FactoryParams as CreateAgentParams,
} from "@artinet/sdk";
import { getContent } from "../utils/get-content.js";
import { LocalRouter } from "./router.js";

export const defaultAgentCard: AgentCard = {
  description: "placeholder",
  name: "placeholder",
  url: "https://agents.artinet.io",
  protocolVersion: "0.3.0",
  version: "1.0.0",
  capabilities: {
    extensions: [],
    streaming: true,
    pushNotifications: false,
  },
  defaultInputModes: [],
  defaultOutputModes: [],
  skills: [],
};

export function wrapRouter(
  instructions: string,
  card: Partial<AgentCard> & {
    name: string;
    description: string;
    skills: AgentSkill[];
  },
  router: LocalRouter,
  params?: Partial<
    Omit<CreateAgentParams, "engine" | "agentCard" | "contexts">
  > & {
    tools?: string[];
    agents?: string[];
  }
): Agent {
  return createAgent({
    ...params,
    engine: AgentBuilder()
      .text(async ({ command }) => {
        return await router.connect({
          message: {
            session: {
              messages: [
                { role: "system", content: instructions },
                { role: "user", content: getContent(command.message) ?? "" },
              ],
            },
          },
          tools: params?.tools ?? router.tools.getToolNames(),
          agents: (params?.agents ?? router.agents.getAgentIds()).filter(
            (agent) => agent !== card.name
          ),
        });
      })
      .createAgentEngine(),
    agentCard: {
      ...defaultAgentCard,
      ...card,
    },
  });
}
