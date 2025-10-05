/**
 * Copyright 2025 The Artinet Project
 * SPDX-License-Identifier: Apache-2.0
 */
import { StdioServerParameters } from "@modelcontextprotocol/sdk/client/stdio.js";
import {
  Agent,
  Command,
  State,
  ContextManagerInterface,
  Update,
  ContextManager,
  FactoryParams as CreateAgentParams,
  createAgent,
  logger,
  AgentCardSchema,
} from "@artinet/sdk";
import { ConnectRequest } from "@artinet/types";
import {
  IRouter,
  InitializedTool,
  RouterParams,
  RouterRequest,
} from "../types/index.js";
import { AgentManager } from "../agents/index.js";
import {
  ToolManager,
  createTool as createToolFunction,
} from "../tools/index.js";
import { SessionManager } from "./session.js";
import { executeTask } from "./task.js";

export const defaultConnectRequest: ConnectRequest = {
  identifier: "deepseek-ai/DeepSeek-R1",
  session: { messages: [] },
  preferredEndpoint: "hf-inference",
  options: { isAuthRequired: false },
};

export class LocalRouter implements IRouter {
  private agentManager: AgentManager;
  private toolManager: ToolManager;
  private contextManager: ContextManagerInterface<Command, State, Update>;
  constructor(
    contexts: ContextManagerInterface<
      Command,
      State,
      Update
    > = new ContextManager(),
    tools: ToolManager = new ToolManager(),
    agents: AgentManager = new AgentManager()
  ) {
    this.contextManager = contexts;
    this.toolManager = tools;
    this.agentManager = agents;
  }

  static async createRouter(
    servers: {
      mcpServers: {
        stdioServers: StdioServerParameters[];
      };
    },
    contexts: ContextManagerInterface<
      Command,
      State,
      Update
    > = new ContextManager(),
    tools: ToolManager = new ToolManager(),
    agents: AgentManager = new AgentManager()
  ): Promise<LocalRouter> {
    const router = new LocalRouter(contexts, tools, agents);
    await Promise.all(
      servers.mcpServers.stdioServers.map(async (server) => {
        await router.createTool(server).catch((error) => {
          logger.error("error creating tool: ", error);
        });
      })
    );
    return router;
  }

  get agents(): AgentManager {
    return this.agentManager;
  }
  get tools(): ToolManager {
    return this.toolManager;
  }
  get contexts(): ContextManagerInterface<Command, State, Update> {
    return this.contextManager;
  }

  async connect(params: RouterParams): Promise<string> {
    const {
      message,
      tools,
      agents,
      callbackFunction,
      taskId,
      abortController,
    } = params;
    let routerRequest: RouterRequest;
    if (typeof message === "string") {
      routerRequest = {
        ...defaultConnectRequest,
        session: { messages: [{ role: "user", content: message }] },
      };
    } else {
      routerRequest = message;
    }
    const sessionManager = new SessionManager(routerRequest);
    await sessionManager
      .initSession(
        tools ?? [],
        agents ?? [],
        this.toolManager,
        this.agentManager
      )
      .catch((error) => {
        logger.error(
          "error initializing session[task:" + taskId + "]: ",
          error
        );
        throw error;
      });
    return await executeTask(
      sessionManager,
      this.toolManager,
      this.agentManager,
      taskId,
      callbackFunction,
      abortController
    ).catch((error) => {
      logger.error("error executing task[task:" + taskId + "]: ", error);
      throw error;
    });
  }

  async close(): Promise<void> {
    await this.agentManager.close();
    await this.toolManager.close();
  }

  createAgent(agentParams: Omit<CreateAgentParams, "contexts">): Agent {
    if (AgentCardSchema.safeParse(agentParams.agentCard).error) {
      throw new Error(
        "Invalid agent card: " +
          (agentParams?.agentCard?.name ?? "name not detected") +
          " " +
          JSON.stringify(AgentCardSchema.safeParse(agentParams.agentCard).error)
      );
    }
    const agent = createAgent({
      ...agentParams,
      contexts: this.contexts,
    });
    this.agents.setAgent(agent);
    return agent;
  }

  async createTool(
    toolServer: StdioServerParameters
  ): Promise<InitializedTool> {
    const tool = await createToolFunction({ toolServer });
    this.tools.setTool(tool);
    return tool;
  }
}
