import path from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { configDir } from "@coach/lib";
import type { SourceConfig } from "./config.js";

// Relative commands/args in config/sources.json are resolved from the repo root,
// regardless of which workspace directory npm launched the process in.
const repoRoot = path.dirname(configDir());

/**
 * Thin wrapper that opens an MCP connection to one tracker's server and calls its
 * tools. This is the deterministic replacement for the AI orchestrating fetches.
 */
export class McpSource {
  private client: Client;
  private connected = false;

  constructor(private readonly source: SourceConfig) {
    this.client = new Client(
      { name: "coach-fetcher", version: "0.1.0" },
      { capabilities: {} },
    );
  }

  async connect(): Promise<void> {
    const t = this.source.transport;
    if (t.type === "stdio") {
      const transport = new StdioClientTransport({
        command: t.command,
        args: t.args,
        env: { ...(process.env as Record<string, string>), ...t.env },
        cwd: repoRoot,
      });
      await this.client.connect(transport);
    } else {
      const transport = new StreamableHTTPClientTransport(new URL(t.url), {
        requestInit: { headers: t.headers },
      });
      await this.client.connect(transport);
    }
    this.connected = true;
  }

  /** Calls a tool and returns its payload as parsed JSON (best effort). */
  async call(tool: string, args: Record<string, unknown>): Promise<unknown> {
    const res: any = await this.client.callTool({ name: tool, arguments: args });
    if (res?.isError) {
      const msg = textOf(res) || `tool ${tool} returned an error`;
      throw new Error(msg);
    }
    // Prefer structured output if the server provides it.
    if (res?.structuredContent !== undefined) return res.structuredContent;
    const text = textOf(res);
    if (text) {
      try {
        return JSON.parse(text);
      } catch {
        return text;
      }
    }
    return res?.content ?? null;
  }

  async close(): Promise<void> {
    if (this.connected) {
      await this.client.close();
      this.connected = false;
    }
  }
}

function textOf(res: any): string {
  if (!res?.content || !Array.isArray(res.content)) return "";
  return res.content
    .filter((c: any) => c?.type === "text" && typeof c.text === "string")
    .map((c: any) => c.text)
    .join("\n");
}
