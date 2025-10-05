/**
 * Copyright 2025 The Artinet Project
 * SPDX-License-Identifier: Apache-2.0
 */
import { configureLogger } from "@artinet/sdk";
configureLogger({ level: "silent" });
import fs from "fs";
const ARTINET_LOG_FILE = process.env.ARTINET_LOG_FILE ?? "./artinet.log";
export const logger = new console.Console(
  fs.createWriteStream(ARTINET_LOG_FILE)
);
