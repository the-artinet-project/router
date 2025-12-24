/**
 * Copyright 2025 The Artinet Project
 * SPDX-License-Identifier: Apache-2.0
 */
import {
  Agent as A2Agent,
  A2AClient,
  CreateAgentParams,
  createAgent,
} from "@artinet/sdk";
import { Runtime } from "@artinet/types";
import * as Callable from "./types.js";
import { v4 as uuidv4 } from "uuid";
import * as Utils from "./agent-util.js";

type implFn = typeof Utils.callAgent;

export class Agent implements Callable.Agent {
  protected constructor(
    private readonly _agent: A2Agent | A2AClient,
    private readonly _uri: string,
    private readonly _id: string = uuidv4()
  ) {}

  private _info: Runtime.AgentInfo | undefined = undefined;
  get info(): Runtime.AgentInfo | undefined {
    if (this._info) {
      return this._info;
    }
    this.getInfo().then((info) => {
      this._info = info;
    });
    return this._info;
  }

  get uri(): string {
    return this._uri;
  }

  get kind(): "agent" {
    return "agent";
  }

  get agent(): A2AClient | A2Agent {
    return this._agent;
  }

  protected _impl: implFn = Utils.callAgent.bind(this);

  async getInfo(): Promise<Runtime.AgentInfo> {
    if (this._info) {
      return this._info;
    }
    this._info = {
      ...(await this.agent.getAgentCard()),
      uri: this._uri,
      id: this._id,
    };
    return this._info;
  }

  async getTarget(): Promise<Runtime.AgentService> {
    const info = await this.getInfo();
    return {
      url: info.url,
      type: "a2a",
      uri: this._uri,
      id: this._id,
      info: info,
    };
  }

  async execute({
    request,
    options,
  }: {
    request: Runtime.AgentRequest;
    options: Callable.Options;
  }): Promise<Runtime.AgentResponse> {
    if (request.uri !== this.uri) {
      throw new Error(`Invalid request URI: ${request.uri} !== ${this.uri}`);
    }
    return await this._impl(this.agent, this.uri, request, options);
  }

  async stop(): Promise<void> {
    if (!(this.agent instanceof A2AClient)) {
      await this.agent.stop();
    }
  }

  static create(params: CreateAgentParams, uri: string = uuidv4()): Agent {
    return Agent.from(createAgent(params), uri);
  }

  static from(agent: A2Agent | A2AClient, uri: string = uuidv4()): Agent {
    return new Agent(agent, uri, uuidv4());
  }
}
