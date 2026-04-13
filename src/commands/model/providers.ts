export type ProviderConfig = {
  id: string;
  label: string;
  baseURL: string;
  needsKey: boolean;
  models: { value: string; label: string }[];
};

export const PROVIDERS: ProviderConfig[] = [
  {
    id: "anthropic",
    label: "Anthropic (Claude)",
    baseURL: "",
    needsKey: false,
    models: [],
  },
  {
    id: "openai",
    label: "OpenAI",
    baseURL: "https://api.openai.com/v1",
    needsKey: true,
    models: [
      { value: "gpt-4o", label: "GPT-4o" },
      { value: "gpt-4o-mini", label: "GPT-4o Mini" },
      { value: "gpt-4-turbo", label: "GPT-4 Turbo" },
      { value: "o1", label: "o1" },
      { value: "o3-mini", label: "o3-mini" },
    ],
  },
  {
    id: "qwen",
    label: "阿里百炼 (通义千问)",
    baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    needsKey: true,
    models: [
      { value: "qwen-max", label: "Qwen-Max" },
      { value: "qwen-plus", label: "Qwen-Plus" },
      { value: "qwen-turbo", label: "Qwen-Turbo" },
      { value: "qwen-long", label: "Qwen-Long" },
    ],
  },
  {
    id: "zhipu",
    label: "智谱 AI (GLM)",
    baseURL: "https://open.bigmodel.cn/api/paas/v4",
    needsKey: true,
    models: [
      { value: "glm-4-air", label: "GLM-4 Air" },
      { value: "glm-4-flash", label: "GLM-4 Flash" },
      { value: "glm-4-plus", label: "GLM-4 Plus" },
      { value: "glm-4-long", label: "GLM-4 Long" },
    ],
  },
  {
    id: "deepseek",
    label: "DeepSeek",
    baseURL: "https://api.deepseek.com/v1",
    needsKey: true,
    models: [
      { value: "deepseek-chat", label: "DeepSeek Chat" },
      { value: "deepseek-reasoner", label: "DeepSeek Reasoner" },
    ],
  },
  {
    id: "ollama",
    label: "Ollama (本地)",
    baseURL: "http://localhost:11434/v1",
    needsKey: false,
    models: [
      { value: "llama3", label: "Llama 3" },
      { value: "llama3.1", label: "Llama 3.1" },
      { value: "qwen2.5", label: "Qwen 2.5" },
      { value: "mistral", label: "Mistral" },
      { value: "gemma2", label: "Gemma 2" },
    ],
  },
  {
    id: "custom",
    label: "自定义 (OpenAI 兼容)",
    baseURL: "",
    needsKey: true,
    models: [],
  },
];
