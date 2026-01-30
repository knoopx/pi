/**
 * LSP Server Configurations
 *
 * Exports an array of all available LSP server configurations
 */

import { LSPServerConfig } from "./types";

import { typescriptServerConfig } from "../servers/typescript-server";
import { pyrightServerConfig } from "../servers/python-server";
import { marksmanServerConfig } from "../servers/marksman-server";
import { yamlServerConfig } from "../servers/yaml-server";
import { jsonServerConfig } from "../servers/json-server";

export const LSP_SERVERS: LSPServerConfig[] = [
  typescriptServerConfig,
  pyrightServerConfig,
  marksmanServerConfig,
  yamlServerConfig,
  jsonServerConfig,
];
