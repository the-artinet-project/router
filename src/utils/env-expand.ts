/**
 * Copyright 2025 The Artinet Project
 * SPDX-License-Identifier: Apache-2.0
 */
import { execSync } from "child_process";
import { platform } from "os";
import { logger } from "@artinet/sdk";
//todo: use dotenvx?
function expandShellVariable(variable: string): string {
  try {
    const isWindows = platform() === "win32";

    if (isWindows) {
      const result = execSync(`cmd /c echo ${variable}`, {
        encoding: "utf8",
        stdio: "pipe",
      });
      return result.trim();
    } else {
      const result = execSync(`sh -c 'echo ${variable}'`, {
        encoding: "utf8",
        stdio: "pipe",
      });
      return result.trim();
    }
  } catch (error) {
    logger.warn(`Failed to expand variable ${variable}:`, error);
    return variable;
  }
}

export function envArgsCapture(args: string[]): string[] {
  return args.map((arg) => expandShellVariable(arg));
}
