/**
 * Copyright 2025 The Artinet Project
 * SPDX-License-Identifier: Apache-2.0
 */
import { Runtime } from "@artinet/types";
import * as Callable from "./types.js";
import { v4 as uuidv4 } from "uuid";
import { Client as MCPClient } from "@modelcontextprotocol/sdk/client/index.js";
import {
  StdioServerParameters,
  StdioClientTransport,
} from "@modelcontextprotocol/sdk/client/stdio.js";
import { Transport as MCPTransport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { safeStdioTransport, safeClose } from "./utils/safeTransport.js";
import { envArgsCapture } from "./utils/env-expand.js";
import { core, logger } from "@artinet/sdk";
import * as Utils from "./tool-util.js";

type implFn = typeof Utils.callTool;
type ServiceRequest = {
  request: Runtime.ToolRequest;
  options: Callable.Options;
};
export class Tool
  implements Callable.Tool, core.Service<ServiceRequest, Runtime.ToolResponse>
{
  protected constructor(
    private readonly _client: MCPClient,
    private readonly _transport: MCPTransport,
    private readonly _uri: string,
    private readonly _id: string = uuidv4()
  ) {}

  readonly kind: "tool" = "tool" as const;

  private _info: Runtime.ToolInfo | undefined = undefined;
  get info(): Runtime.ToolInfo | undefined {
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
  get tool(): MCPClient {
    return this._client;
  }

  protected _impl: implFn = Utils.callTool.bind(this);

  async getInfo(): Promise<Runtime.ToolInfo> {
    if (this._info) {
      return this._info;
    }
    this._info = await Tool._createInfo(this._client);
    return this._info;
  }

  async getTarget(): Promise<Runtime.ToolService> {
    const info = await this.getInfo();
    return {
      type: "mcp",
      uri: this._uri,
      id: this._id,
      info: info,
    };
  }

  async execute({
    request,
    options,
  }: ServiceRequest): Promise<Runtime.ToolResponse> {
    if (request.uri !== this.uri) {
      throw new Error(`Invalid request URI: ${request.uri} !== ${this.uri}`);
    }
    return await this._impl(this.tool, this.uri, request, options);
  }

  async stop(): Promise<void> {
    await safeClose(this._client, this._transport as StdioClientTransport);
  }

  protected static async _createInfo(
    client: MCPClient
  ): Promise<Runtime.ToolInfo> {
    return await Utils.getToolInfo(client);
  }

  static async create(
    params: StdioServerParameters,
    uri: string = uuidv4()
  ): Promise<Tool> {
    const transport = safeStdioTransport({
      ...params,
      args: envArgsCapture(params.args ?? []),
    });
    //monitor the error stream for updates during initialization
    const handle = (data: Buffer) => {
      logger.warn(`[${uri}]: create tool error: `, data.toString());
    };
    (transport as StdioClientTransport)?.stderr?.on("data", handle);
    const client = await Utils.initClient(transport, uri);
    const tool = Tool.from(client, transport, uri);
    (transport as StdioClientTransport)?.stderr?.off("data", handle);
    return tool;
  }

  static from(
    client: MCPClient,
    transport: MCPTransport,
    uri: string = uuidv4()
  ): Tool {
    return new Tool(client, transport, uri);
  }
}
