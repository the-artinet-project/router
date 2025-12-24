/**
 * Copyright 2025 The Artinet Project
 * SPDX-License-Identifier: Apache-2.0
 */
import { Manager as BaseManager } from "@artinet/sdk";
import pLimit from "p-limit";
import { logger } from "@artinet/sdk";
import * as Callable from "./types.js";
import * as Util from "./manager-util.js";

type requestFn = typeof Util.request;

export class Manager extends BaseManager<Callable.Agent | Callable.Tool> {
  protected _request: requestFn = Util.request.bind(this);

  get count(): number {
    return this.data.size;
  }

  get uris(): string[] {
    return Array.from(this.data.keys());
  }

  get values(): (Callable.Agent | Callable.Tool)[] {
    return Array.from(this.data.values());
  }

  async stop(): Promise<void> {
    await Promise.all((await this.list())?.map((value) => value.stop()));
  }

  protected async _processRequest(
    request: Callable.Request,
    options: Callable.Options
  ): Promise<Callable.Response | undefined> {
    const callable = await this.get(request.uri);
    if (!callable) {
      logger.warn(`[processRequest:target:${request.uri}]: not found.`);
      return undefined;
    }
    return await this._request(callable, request, options);
  }

  async call({
    request,
    options,
  }: {
    request: Callable.Request[];
    options: Callable.Options;
  }): Promise<Callable.Response[]> {
    if (request.length === 0) {
      return [];
    }
    const responses: Callable.Response[] = [];
    const limit = pLimit(
      Math.min(Callable.DEFAULT_CONCURRENCY, request.length)
    );
    await Promise.allSettled(
      request.map((req) => {
        limit(async () => {
          const result = await this._processRequest(req, options).catch(
            (err) => {
              logger.error(
                `[Manager:execute:callable:${req.uri}]: error processing request: `,
                err
              );
              return undefined;
            }
          );
          if (result) {
            responses.push(result);
          }
          return;
        });
      })
    );
    return responses;
  }
}
