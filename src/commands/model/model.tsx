import React, { useState } from 'react'
import { Box, Text, useInput } from '../../ink.js'
import TextInput from '../../components/TextInput.js'
import { getGlobalConfig, saveGlobalConfig } from '../../utils/config.js'
import type {
  LocalJSXCommandContext,
  LocalJSXCommandOnDone,
} from '../../types/command.js'
import type { ToolUseContext } from '../../Tool.js'
import { PROVIDERS, type ProviderConfig } from './providers.js'

type Step =
  | 'select-provider'
  | 'select-model'
  | 'input-key'
  | 'input-baseurl'
  | 'input-model'
  | 'done'

function getCurrentConfig() {
  return getGlobalConfig().customModelProvider ?? null
}

export async function call(
  onDone: LocalJSXCommandOnDone,
  _context: ToolUseContext & LocalJSXCommandContext,
): Promise<React.ReactElement> {
  return <ModelPicker onDone={onDone} />
}

function ModelPicker({ onDone }: { onDone: LocalJSXCommandOnDone }) {
  const current = getCurrentConfig()
  const [step, setStep] = useState<Step>('select-provider')
  const [providerIdx, setProviderIdx] = useState(0)
  const [modelIdx, setModelIdx] = useState(0)
  const [apiKey, setApiKey] = useState('')
  const [baseURL, setBaseURL] = useState('')
  const [customModel, setCustomModel] = useState('')
  const [cursorOffset, setCursorOffset] = useState(0)

  const selectedProvider = PROVIDERS[providerIdx]!

  // ── Step: select provider ──────────────────────────────────────────────
  useInput(
    (input, key) => {
      if (step !== 'select-provider') return
      if (key.upArrow) setProviderIdx(i => Math.max(0, i - 1))
      if (key.downArrow) setProviderIdx(i => Math.min(PROVIDERS.length - 1, i + 1))
      if (key.return) {
        const p = PROVIDERS[providerIdx]!
        if (p.id === 'anthropic') {
          // Reset to Anthropic — clear custom config
          saveGlobalConfig(c => {
            const next = { ...c }
            delete next.customModelProvider
            return next
          })
          onDone('已切换回 Anthropic (Claude) 默认模型', { display: 'system' })
          return
        }
        if (p.id === 'custom') {
          setBaseURL('')
          setStep('input-baseurl')
          return
        }
        setBaseURL(p.baseURL)
        if (p.models.length > 0) {
          setModelIdx(0)
          setStep('select-model')
        } else {
          setCustomModel('')
          setStep('input-model')
        }
      }
      if (key.escape) onDone('已取消', { display: 'system' })
    },
    { isActive: step === 'select-provider' },
  )

  // ── Step: select model ────────────────────────────────────────────────
  useInput(
    (input, key) => {
      if (step !== 'select-model') return
      const models = selectedProvider.models
      if (key.upArrow) setModelIdx(i => Math.max(0, i - 1))
      if (key.downArrow) setModelIdx(i => Math.min(models.length - 1, i + 1))
      if (key.return) {
        if (selectedProvider.needsKey) {
          setApiKey('')
          setStep('input-key')
        } else {
          // Ollama: no key needed
          save(selectedProvider, models[modelIdx]!.value, '', baseURL)
        }
      }
      if (key.escape) setStep('select-provider')
    },
    { isActive: step === 'select-model' },
  )

  function save(
    provider: ProviderConfig,
    model: string,
    key: string,
    url: string,
  ) {
    saveGlobalConfig(c => ({
      ...c,
      customModelProvider: {
        provider: provider.id === 'ollama' ? 'ollama' : 'openai',
        apiKey: key || undefined,
        baseURL: url,
        model,
      },
    }))

    // Apply env vars immediately for this session
    if (provider.id !== 'ollama') {
      process.env.CLAUDE_CODE_USE_OPENAI = '1'
      delete process.env.CLAUDE_CODE_USE_OLLAMA
    } else {
      process.env.CLAUDE_CODE_USE_OLLAMA = '1'
      delete process.env.CLAUDE_CODE_USE_OPENAI
    }
    if (key) process.env.OPENAI_API_KEY = key
    process.env.OPENAI_BASE_URL = url
    process.env.CLAUDE_CODE_MODEL = model

    onDone(
      `✓ 已切换到 ${provider.label} · ${model}`,
      { display: 'system' },
    )
  }

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <Box flexDirection="column" paddingY={1}>
      <Box marginBottom={1}>
        <Text bold>🤖 选择模型</Text>
        {current && (
          <Text dimColor>
            {' '}(当前: {current.model} @ {current.baseURL})
          </Text>
        )}
      </Box>

      {step === 'select-provider' && (
        <Box flexDirection="column">
          <Text dimColor>↑↓ 选择，Enter 确认，Esc 取消</Text>
          <Box flexDirection="column" marginTop={1}>
            {PROVIDERS.map((p, i) => (
              <Box key={p.id}>
                <Text color={i === providerIdx ? 'cyan' : undefined}>
                  {i === providerIdx ? '❯ ' : '  '}
                  {p.label}
                </Text>
              </Box>
            ))}
          </Box>
        </Box>
      )}

      {step === 'select-model' && (
        <Box flexDirection="column">
          <Text dimColor>
            {selectedProvider.label} · ↑↓ 选择，Enter 确认，Esc 返回
          </Text>
          <Box flexDirection="column" marginTop={1}>
            {selectedProvider.models.map((m, i) => (
              <Box key={m.value}>
                <Text color={i === modelIdx ? 'cyan' : undefined}>
                  {i === modelIdx ? '❯ ' : '  '}
                  {m.label}
                  <Text dimColor> ({m.value})</Text>
                </Text>
              </Box>
            ))}
          </Box>
        </Box>
      )}

      {step === 'input-baseurl' && (
        <Box flexDirection="column" gap={1}>
          <Text>输入 API Base URL（如 https://xxx.com/v1）：</Text>
          <TextInput
            value={baseURL}
            onChange={setBaseURL}
            onSubmit={val => {
              setBaseURL(val)
              setCustomModel('')
              setStep('input-model')
            }}
            focus
            cursorOffset={cursorOffset}
            onChangeCursorOffset={setCursorOffset}
            columns={80}
          />
        </Box>
      )}

      {step === 'input-model' && (
        <Box flexDirection="column" gap={1}>
          <Text>输入模型名称（如 gpt-4o、qwen-max）：</Text>
          <TextInput
            value={customModel}
            onChange={setCustomModel}
            onSubmit={val => {
              if (!val.trim()) return
              if (selectedProvider.needsKey) {
                setApiKey('')
                setStep('input-key')
              } else {
                save(selectedProvider, val.trim(), '', baseURL)
              }
            }}
            focus
            cursorOffset={cursorOffset}
            onChangeCursorOffset={setCursorOffset}
            columns={80}
          />
        </Box>
      )}

      {step === 'input-key' && (
        <Box flexDirection="column" gap={1}>
          <Text>
            输入 {selectedProvider.label} API Key
            <Text dimColor>（输入后按 Enter，留空跳过）</Text>：
          </Text>
          <TextInput
            value={apiKey}
            onChange={setApiKey}
            onSubmit={val => {
              const model =
                selectedProvider.models.length > 0
                  ? selectedProvider.models[modelIdx]!.value
                  : customModel
              save(selectedProvider, model, val.trim(), baseURL)
            }}
            focus
            cursorOffset={cursorOffset}
            onChangeCursorOffset={setCursorOffset}
            columns={80}
          />
        </Box>
      )}
    </Box>
  )
}
