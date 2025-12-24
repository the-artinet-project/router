/**
 * Copyright 2025 The Artinet Project
 * SPDX-License-Identifier: Apache-2.0
 */
import { API } from "@artinet/types";
import { A2A, getContent } from "@artinet/sdk";

export function getHistory(
  task: A2A.Task,
  filter?: (message: API.Message) => boolean
): API.Message[] {
  if (!task) return [];
  let history: API.Message[] =
    task.history?.map((message: A2A.Message) => {
      return {
        role: message.role,
        content: getContent(message) ?? "",
      };
    }) ?? [];
  if (!task.metadata?.referencedTasks) return history;
  history = [
    ...(task.metadata?.referencedTasks as A2A.Task[])
      ?.flatMap((referencedTask: A2A.Task) => {
        const sessionMessages: API.Message[] =
          referencedTask.history?.map((message: A2A.Message) => {
            return {
              role: message.role,
              content: getContent(message) ?? "",
            };
          }) ?? [];
        return sessionMessages;
      })
      .filter((message: API.Message) => message !== undefined)
      .filter(
        (message: API.Message) =>
          message.content !== "" &&
          message.content !== "{}" &&
          message.content !== "[]"
      ),
    ...history,
  ];

  return filter ? history.filter(filter) : history;
}
