/**
 * Copyright 2025 The Artinet Project
 * SPDX-License-Identifier: Apache-2.0
 */
import {
  core,
  A2A,
  Agent as A2A_Agent,
  Service as A2A_Service,
  CreateAgentParams,
  getContent,
  FAILED_UPDATE,
  SUBMITTED_UPDATE,
  STATUS_UPDATE,
  MessageBuilder,
  createAgent,
} from "@artinet/sdk";
import { API } from "@artinet/types";
import * as Callable from "./types.js";
import { Manager } from "./manager.js";
import * as Util from "./model-util.js";
import { Monitor } from "./monitor.js";
import { logger } from "@artinet/sdk";
import { v4 as uuidv4 } from "uuid";
import { getHistory } from "./utils/history.js";

type AddFn = typeof Util.add;
type ReactFn = typeof Util.react;

type ServiceRequest = {
  request: API.ConnectRequest;
  options?: Omit<Callable.Options, "tasks" | "callback">;
  messenger?: A2A.Context["messages"];
};

export class Model
  extends Manager
  implements core.Service<ServiceRequest, API.ConnectResponse>
{
  protected constructor(
    private readonly modelId: string = "deepseek-r1",
    readonly abortSignal: AbortSignal = new AbortController().signal,
    protected _provider: Util.APIProvider,
    _data: Map<string, Callable.Agent | Callable.Tool> = new Map(),
    private _sessions: Record<string, Record<string, string>> = {},
    private _history: Callable.Response[] = [],
    private _events: Monitor = new Monitor()
  ) {
    super(_data);
  }

  get events(): Monitor {
    return this._events;
  }
  get provider(): Util.APIProvider {
    return this._provider;
  }
  get sessions(): Record<string, Record<string, string>> {
    return this._sessions;
  }
  get history(): Callable.Response[] {
    return this._history;
  }

  protected _add: AddFn = Util.add.bind(this);
  protected _react: ReactFn = Util.react.bind(this);
  private _addPromise: Promise<void> | undefined = undefined;

  private addPromise(newPromise: Promise<any>): void {
    if (this._addPromise) {
      this._addPromise = this._addPromise.then(() => newPromise);
    } else {
      this._addPromise = newPromise;
    }
  }

  async execute({
    request,
    options,
  }: ServiceRequest): Promise<API.ConnectResponse> {
    if (this._addPromise) {
      await this._addPromise;
    }

    const parentTaskId = options?.parentTaskId ?? uuidv4();
    const abortSignal = options?.abortSignal ?? this.abortSignal;

    return await this._react(
      request,
      this.provider,
      this.call.bind(this),
      this._history,
      {
        ...options,
        parentTaskId: parentTaskId,
        abortSignal: abortSignal,
        tasks: this.sessions,
        callback: (data: Callable.Response) =>
          this.events.emit("update", data, undefined),
      }
    );
  }

  get engine(): A2A.Engine {
    const self = this;
    return async function* (context: A2A.Context) {
      const message: string | undefined = getContent(context.userMessage);

      if (!message) {
        yield FAILED_UPDATE(
          context.taskId,
          context.contextId,
          context.userMessage.messageId,
          "no user message detected"
        );
        return;
      }

      yield SUBMITTED_UPDATE(
        context.taskId,
        context.contextId,
        context.userMessage
      );

      const messages: API.Message[] = [
        ...getHistory(await context.getTask()),
        {
          role: "user",
          content: message,
        },
      ];

      const request: API.ConnectRequest = Util.request(
        self.modelId,
        messages,
        Util.options(self.values)
      );

      const response: API.ConnectResponse = await self.execute({
        request,
        options: {
          parentTaskId: context.taskId,
          abortSignal: context.abortSignal,
        },
      });

      yield STATUS_UPDATE(
        context.taskId,
        context.contextId,
        A2A.TaskState.completed,
        new MessageBuilder({
          contextId: context.contextId,
          taskId: context.taskId,
          role: "agent",
          parts: [{ kind: "text", text: Util.response(response) }],
        }).message
      );

      return;
    };
  }
  //todo: add instructions to the agent??
  get agent(): A2A_Agent {
    return createAgent({
      agentCard: Util.createCard(this.modelId, this.values),
      engine: this.engine,
      contexts: this._events,
    });
  }

  add(service: Util.CallableService): Model {
    if (
      service instanceof A2A_Service ||
      (typeof service === "object" && "engine" in service)
    ) {
      (service as A2A_Service | CreateAgentParams).contexts = this._events;
    }
    this.addPromise(
      this._add(service)
        .then((callable) => {
          super.set(callable.uri, callable);
        })
        .catch((error) => {
          logger.error(
            `[Model:add]: error adding service: ${error.message}`,
            error
          );
        })
    );
    return this;
  }

  async connect(
    messages:
      | string
      | API.Message
      | API.Session
      | Omit<API.ConnectRequest, "options">,
    options?: API.ConnectOptions
  ): Promise<string> {
    const request: API.ConnectRequest = Util.request(
      this.modelId,
      messages,
      Util.options(this.values, options)
    );

    const response: API.ConnectResponse = await this.execute({
      request,
    });

    return Util.response(response);
  }

  static create({
    modelId = "deepseek-r1",
    provider,
    services = [],
    abortSignal = new AbortController().signal,
    sessions = {},
    history = [],
    events = new Monitor(),
  }: CreateModelParams): Model {
    return new Model(
      modelId,
      abortSignal,
      provider,
      new Map(services.map((service) => [service.uri, service])),
      sessions,
      history,
      events
    );
  }
}

interface CreateModelParams {
  modelId: string;
  provider: Util.APIProvider;
  services?: (Callable.Agent | Callable.Tool)[];
  abortSignal?: AbortSignal;
  sessions?: Record<string, Record<string, string>>;
  history?: Callable.Response[];
  events?: Monitor;
}

export const create = Model.create;
export type Params = CreateModelParams;
