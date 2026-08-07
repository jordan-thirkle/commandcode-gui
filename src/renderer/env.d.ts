import type { BridgeEvent } from '../shared/bridgeEvents';
import type { RunOptions } from '../main/cli/commandBuilder';
import type { SessionSummary } from '../main/sessionStore';
import type { McpServerInfo, SkillInfo, AgentInfo, SettingsSnapshot } from '../main/surface';

export interface CmdGuiApi {
  run(payload: Partial<RunOptions> & { prompt: string }): Promise<{ ok: boolean }>;
  abort(): Promise<{ ok: boolean }>;
  listSessions(): Promise<SessionSummary[]>;
  readSession(id: string): Promise<string>;
  mcpList(): Promise<McpServerInfo[]>;
  listSkills(): Promise<SkillInfo[]>;
  listAgents(): Promise<AgentInfo[]>;
  getConfig(): Promise<SettingsSnapshot>;
  onRunEvent(cb: (evt: BridgeEvent) => void): () => void;
}

declare global {
  interface Window {
    cmdgui?: CmdGuiApi;
  }
}
