/**
 * Model catalog — exact ids from the Command Code model registry
 * (reference/models.md). Never invent a model id; the app reads from here.
 */

export interface ModelInfo {
  id: string;
  name: string;
  context: string;
  efforts: string[];
  bestFor: string;
}

export const MODELS: ModelInfo[] = [
  { id: 'deepseek/deepseek-v4-pro', name: 'DeepSeek V4 Pro', context: '1M', efforts: ['high', 'max'], bestFor: 'hybrid-attention long-context reasoning' },
  { id: 'deepseek/deepseek-v4-flash', name: 'DeepSeek V4 Flash', context: '1M', efforts: ['high', 'max'], bestFor: 'fast hybrid-attention reasoning' },
  { id: 'claude-sonnet-5', name: 'Claude Sonnet 5', context: '1M', efforts: ['low', 'medium', 'high', 'xhigh', 'max'], bestFor: 'best combo of speed & intelligence' },
  { id: 'claude-opus-5', name: 'Claude Opus 5', context: '1M', efforts: ['low', 'medium', 'high', 'xhigh', 'max'], bestFor: 'most intelligent Opus for agents and coding' },
  { id: 'gpt-5.6-sol', name: 'GPT-5.6 Sol', context: '1.05M', efforts: ['low', 'medium', 'high', 'xhigh', 'max'], bestFor: 'frontier model for complex professional work' },
  { id: 'gpt-5.6-luna', name: 'GPT-5.6 Luna', context: '1.05M', efforts: ['low', 'medium', 'high', 'xhigh', 'max'], bestFor: 'optimized for cost-sensitive workloads' },
  { id: 'moonshotai/Kimi-K2.5', name: 'Kimi K2.5', context: '256K', efforts: [], bestFor: 'multimodal frontend coding' },
  { id: 'xiaomi/mimo-v2.5-pro', name: 'MiMo V2.5 Pro', context: '1M', efforts: [], bestFor: 'high-capability long-context agentic coding' },
  { id: 'google/gemini-3.5-flash', name: 'Gemini 3.5 Flash', context: '1M', efforts: ['low', 'medium', 'high'], bestFor: 'Pro-level coding proficiency, parallel agentic execution' },
  { id: 'sakana/fugu-ultra', name: 'Fugu Ultra', context: '1M', efforts: ['high', 'xhigh'], bestFor: 'multi-agent orchestration across frontier models' },
];

/** Presets matching the DUSTLINE project routing conventions (AGENTS.md). */
export const MODEL_PRESETS: Array<{ label: string; model: string; effort?: string }> = [
  { label: 'DeepSeek V4 Pro (build/runner)', model: 'deepseek/deepseek-v4-pro', effort: 'high' },
  { label: 'GPT-5.6 Luna (quality-critical)', model: 'gpt-5.6-luna', effort: 'high' },
  { label: 'MiMo V2.5 Pro (bulk/mechanical)', model: 'xiaomi/mimo-v2.5-pro' },
  { label: 'Claude Sonnet 5', model: 'claude-sonnet-5', effort: 'medium' },
];

export const DEFAULT_MODEL = 'deepseek/deepseek-v4-pro';
export const DEFAULT_EFFORT = 'high';

export function modelById(id: string): ModelInfo | undefined {
  return MODELS.find((m) => m.id === id);
}
