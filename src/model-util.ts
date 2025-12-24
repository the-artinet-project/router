/**
 * Copyright 2025 The Artinet Project
 * SPDX-License-Identifier: Apache-2.0
 */
import {
  A2AClient,
  CreateAgentParams,
  Agent as A2A_Agent,
  Service as A2A_Service,
  A2A,
} from "@artinet/sdk";
import { API, Runtime } from "@artinet/types";
import * as Callable from "./types.js";
import { StdioServerParameters } from "@modelcontextprotocol/sdk/client/stdio.js";
import { Agent } from "./agent.js";
import { Tool } from "./tool.js";

export type APIProvider = (
  request: API.ConnectRequest,
  abortSignal?: AbortSignal
) => Promise<API.ConnectResponse>;

export type InvokeCallables = ({
  request,
  options,
}: {
  request: Callable.Request[];
  options: Callable.Options;
}) => Promise<Callable.Response[]>;

function createCall(response: API.ConnectResponse): Callable.Request[] {
  return [
    ...(response.options?.tools?.requests ?? []),
    ...(response.options?.agents?.requests ?? []),
  ];
}

function update(
  request: API.ConnectRequest,
  responses: Callable.Response[] = [],
  messages: API.ConnectRequest["messages"] = []
): API.ConnectRequest {
  const options = request.options;
  request.options = {
    ...options,
    tools: {
      ...options?.tools,
      responses: [
        ...(options?.tools?.responses ?? []),
        ...(responses.filter((response) => Runtime.isToolResponse(response)) ??
          []),
      ],
    },
    agents: {
      ...options?.agents,
      responses: [
        ...(options?.agents?.responses ?? []),
        ...(responses.filter((response) => Runtime.isAgentResponse(response)) ??
          []),
      ],
    },
  };
  request.messages = [...request.messages, ...messages];
  return request;
}

export function options(
  callables: (Callable.Agent | Callable.Tool)[],
  options?: API.ConnectOptions
): API.ConnectOptions {
  const targets = callables.map((callable) => callable.getTarget());
  const tools = targets.filter((target) => Runtime.isToolService(target));
  const agents = targets.filter((target) => Runtime.isAgentService(target));
  //we limit the options to the tools and agents that are actually available
  return {
    ...options,
    tools: {
      ...options?.tools,
      services: tools,
    },
    agents: {
      ...options?.agents,
      services: agents,
    },
  };
}

export function request(
  modelId: string,
  messages: string | API.Message | API.Session | API.ConnectRequest,
  options: API.ConnectOptions
): API.ConnectRequest {
  let request: API.ConnectRequest = {
    messages: [],
    identifier: modelId,
    preferredEndpoint: "auto",
    options: options,
  };

  if (typeof messages === "string") {
    request = {
      ...request,
      messages: [{ role: "user", content: messages }],
    };
  } else if (API.isMessage(messages)) {
    request = {
      ...request,
      messages: [messages],
    };
  } else if (API.isSession(messages)) {
    request = {
      ...request,
      messages: messages,
    };
  } else if (API.isConnectRequest(messages)) {
    request = {
      ...request,
      ...messages,
    };
  } else {
    throw new Error("Invalid messages type: " + typeof messages);
  }
  return request;
}

export function response(response: API.ConnectResponse): string {
  return typeof response.agentResponse === "string"
    ? response.agentResponse
    : typeof response.agentResponse.content === "string"
    ? response.agentResponse.content
    : response.agentResponse.content.text;
}

export type CallableService =
  | A2A_Agent
  | A2AClient
  | Omit<CreateAgentParams, "contexts">
  | StdioServerParameters;

export async function add<T extends CallableService = CallableService>(
  service: T
): Promise<Callable.Agent | Callable.Tool> {
  let callable: Callable.Agent | Callable.Tool | undefined = undefined;
  if (service instanceof A2A_Service || service instanceof A2AClient) {
    callable = Agent.from(service);
  } else if (typeof service === "object" && "engine" in service) {
    callable = Agent.create(service);
  } else if (typeof service === "object" && "command" in service) {
    callable = await Tool.create(service);
  }
  if (!callable) {
    throw new Error(`[Model:add]: Invalid service type: ${typeof service}`);
  }
  return callable;
}

const max_iterations_message: API.Message = {
  role: "system",
  content: `
The assistant has run out of executions for this task and will not be able to continue.
The assistant must now formulate a final response to the user summarising what has been achieved so far and what is left to be done.
In the final response, the assistant will also provide the user with suggestions for next steps and ask them whether they would like to continue.`,
};

export async function react(
  request: API.ConnectRequest,
  provider: APIProvider,
  call: InvokeCallables,
  history: Callable.Response[] = [],
  options: Callable.Options
): Promise<API.ConnectResponse> {
  let iterations = options?.iterations ?? Callable.DEFAULT_ITERATIONS;

  let response: API.ConnectResponse | undefined = undefined;
  let results: Callable.Response[] = [];

  for (let i = 0; i < iterations; i++) {
    const response: API.ConnectResponse = await provider(
      update(
        request,
        results,
        i >= iterations - 1 ? [max_iterations_message] : []
      )
    );

    results = await call({ request: createCall(response), options: options });

    if (results.length === 0) {
      break;
    }

    history = [...history, ...results];
  }

  if (!response) {
    throw new Error("No response from model");
  }

  return response;
}

export function createCard(
  modelId: string,
  callables: (Callable.Agent | Callable.Tool)[]
): Partial<A2A.AgentCard> & { name: string; description: string } {
  return {
    name: `${modelId}-Agent`,
    description: `An agent that uses the ${modelId} large language model.`,
    skills: callables.map((value) => {
      let name = `${value.kind}-${value.uri}`;
      let description = `${value.kind} - ${value.uri}`;
      const info = value.info;
      if (info) {
        name = Runtime.isAgentInfo(info) ? info.name : info.implementation.name;
        description = Runtime.isAgentInfo(info)
          ? info.description
          : info.instructions ?? `A ${info.implementation.name} tool.`;
      }
      return {
        id: value.uri,
        name: name,
        description: description,
        tags: [value.kind],
      };
    }),
  };
}
