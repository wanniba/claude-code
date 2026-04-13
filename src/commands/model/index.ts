import type { Command } from '../../commands.js'

const model = {
  type: 'local-jsx',
  name: 'model',
  description: 'Select AI model provider and configure API key',
  isEnabled: () => true,
  load: () => import('./model.js'),
} satisfies Command

export default model
