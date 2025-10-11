/**
 * Copyright 2025 The Artinet Project
 * SPDX-License-Identifier: Apache-2.0
 */
import { StdioServerParameters } from "@modelcontextprotocol/sdk/client/stdio.js";
import {
  Agent,
  FactoryParams as CreateAgentParams,
  createAgent,
  logger,
  AgentCardSchema,
  State,
  Update,
  AgentSkill,
  AgentCard,
} from "@artinet/sdk";
import { AgentResponse, ToolResponse, ConnectRequest } from "@artinet/types";
import {
  IRouter,
  InitializedTool,
  RouterParams,
  ApiProvider,
  TaskOptions,
} from "../types/index.js";
import { AgentManager } from "../agents/index.js";
import {
  ToolManager,
  createTool as createToolFunction,
} from "../tools/index.js";
import { SessionManager } from "./session.js";
import { executeTask } from "./task.js";
import { EventBus } from "../utils/event-bus.js";
import { v4 as uuidv4 } from "uuid";
import { connectv1 } from "~/api/connect.js";
import { wrapRouter } from "./agent-wrapper.js";

export const defaultConnectRequest: ConnectRequest = {
  identifier: "deepseek-ai/DeepSeek-R1",
  session: { messages: [] },
  preferredEndpoint: "hf-inference",
  options: { isAuthRequired: false },
};

function parseParams(
  params: RouterParams,
  defaultOptions: TaskOptions = {}
): {
  options: Omit<TaskOptions, "callbackFunction">;
  connectRequest: ConnectRequest;
  api: ApiProvider;
} {
  let { options, message: routerRequest } = params;
  options = {
    ...defaultOptions,
    ...options,
    taskId: options?.taskId ?? uuidv4(),
  };
  let connectRequest: ConnectRequest;
  let api: ApiProvider = connectv1;
  if (typeof routerRequest === "string") {
    connectRequest = {
      ...defaultConnectRequest,
      session: { messages: [{ role: "user", content: routerRequest }] },
    };
  } else {
    connectRequest = {
      ...defaultConnectRequest,
      ...routerRequest,
    };
    api = routerRequest?.apiProvider ?? api;
  }
  return { options, connectRequest, api };
}

export class LocalRouter implements IRouter {
  private defaultOptions: TaskOptions;
  private agentManager: AgentManager;
  private toolManager: ToolManager;
  private contextManager: EventBus;
  constructor(
    contexts: EventBus = new EventBus(),
    tools: ToolManager = new ToolManager(),
    agents: AgentManager = new AgentManager(),
    defaultOptions: TaskOptions = {}
  ) {
    this.defaultOptions = defaultOptions;
    this.contextManager = contexts;
    this.toolManager = tools;
    this.agentManager = agents;
  }

  /**
   * @description Creates a new router.
   * @param servers - A list of stdio MCP Servers to instantiate the router with.
   * @param contexts - A shared context manager/event bus for the router and all of its subagents. If not provided, a new event bus will be created.
   * @param tools - A tool manager to house and manage the tools available to the router. If not provided, a new tool manager will be created.
   * @param agents - An agent manager to house and manage the agents available to the router. If not provided, a new agent manager will be created.
   * @param defaultOptions.taskId - The default taskId to use for the router.
   * @param defaultOptions.maxIterations - The default maximum number of iterations to run for the router.
   * @param defaultOptions.callbackFunction - The default function to call when an update is occurs.
   * @param defaultOptions.abortSignal - The default signal to abort execution of the task.
   * @returns The created router.
   */
  static async createRouter(
    servers: {
      mcpServers: {
        stdioServers: StdioServerParameters[];
      };
    },
    contexts: EventBus = new EventBus(),
    tools: ToolManager = new ToolManager(),
    agents: AgentManager = new AgentManager(),
    defaultOptions: TaskOptions = {}
  ): Promise<LocalRouter> {
    const router = new LocalRouter(contexts, tools, agents, defaultOptions);
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
  get contexts(): EventBus {
    return this.contextManager;
  }

  private get emit() {
    return this.contextManager.emit.bind(this.contextManager);
  }

  get on() {
    return this.contextManager.on.bind(this.contextManager);
  }

  get off() {
    return this.contextManager.off.bind(this.contextManager);
  }

  get removeListener() {
    return this.contextManager.removeListener.bind(this.contextManager);
  }

  get removeAllListeners() {
    return this.contextManager.removeAllListeners.bind(this.contextManager);
  }

  get addListener() {
    return this.contextManager.addListener.bind(this.contextManager);
  }

  get listeners() {
    return this.contextManager.listeners.bind(this.contextManager);
  }

  get listenerCount() {
    return this.contextManager.listenerCount.bind(this.contextManager);
  }

  get eventNames() {
    return this.contextManager.eventNames.bind(this.contextManager);
  }

  /**
   * @description Connects to the router.
   * @param params.message - The message to send to the router. Either a string or a RouterRequest object.
   * @param params.tools - Provide a white list of tools that can be used by llm (if a tool is not available/has not been added to the router it will be ignored).
   * @param params.agents - Provide a white list of agents that can be used by llm (if an agent is not available/has not been added to the router it will be ignored).
   * @param params.options.taskId - Include a taskId to identify to resume operations on the same task.
   * @param params.options.maxIterations - The maximum number of iterations to run.
   * @param params.options.callbackFunction - An optional function to call when an update is occurs.
   * @param params.options.abortSignal - An optional signal to abort execution of the task.
   * @returns The result of the connection.
   */
  async connect(params: RouterParams): Promise<string> {
    const { tools, agents } = params;
    const { options, connectRequest, api } = parseParams(
      params,
      this.defaultOptions
    );
    const sessionManager = new SessionManager(connectRequest, api);
    await sessionManager
      .initSession(
        tools ?? [],
        agents ?? [],
        this.toolManager,
        this.agentManager
      )
      .catch((error) => {
        logger.error(
          `error initializing session[task:${options.taskId}]: `,
          error
        );
        throw error;
      });
    return await executeTask(
      sessionManager,
      this.toolManager,
      this.agentManager,
      {
        ...options,
        callbackFunction: (
          state: State | AgentResponse | ToolResponse,
          update: Update
        ) => this.emit("update", state, update),
      }
    ).catch((error) => {
      logger.error(`error executing task[task:${options.taskId}]: `, error);
      throw error;
    });
  }

  async close(): Promise<void> {
    await this.agentManager.close();
    await this.toolManager.close();
  }

  /**
   * @description Creates and Attaches an Agent to the router.
   */
  createAgent(agentParams: Omit<CreateAgentParams, "contexts">): Agent {
    if (AgentCardSchema.safeParse(agentParams.agentCard).error) {
      throw new Error(
        `Invalid agent card: ${
          agentParams?.agentCard?.name ?? "name not detected"
        } - ${JSON.stringify(
          AgentCardSchema.safeParse(agentParams.agentCard).error
        )}`
      );
    }
    const agent = createAgent({
      ...agentParams,
      contexts: this.contexts,
    });
    this.agents.setAgent(agent);
    return agent;
  }

  /**
   * @description Creates and Attaches an MCPTool to the router.
   */
  async createTool(
    toolServer: StdioServerParameters
  ): Promise<InitializedTool> {
    const tool = await createToolFunction({ toolServer });
    this.tools.setTool(tool);
    return tool;
  }

  /**
   * @description Creates an Agent from the router.
   * @param instructions - The system prompt that the agent will follow when executing a task.
   * @param params.tools - Provide a list of tool names or identifiers that the agent will have access to (if none are provided, all tools will be available; if a tool is not available it will be ignored).
   * @param params.agents - Provide a list of agent names or identifiers that the agent will have access to (if none are provided, all agents will be available; if an agent is not available it will be ignored).
   * @returns The constructed agent.
   */
  toAgent(
    instructions: string,
    card: Partial<AgentCard> & {
      name: string;
      description: string;
      skills: AgentSkill[];
    },
    params?: Partial<
      Omit<CreateAgentParams, "engine" | "agentCard" | "contexts">
    > & {
      tools?: string[];
      agents?: string[];
    }
  ): Agent {
    return wrapRouter(instructions, card, this, params);
  }
}
