import type { PluginRule } from './types.js'

export const noImportDist: PluginRule = {
  meta: {
    type: 'problem',
    schema: [],
    messages: { noImportDist: 'Do not import modules in `dist` folder, got {{path}}' },
  },
  create(context) {
    return {
      ImportDeclaration(node) {
        const path = node.source.value
        if (path === 'dist' || (path.startsWith('.') && /\/dist(?:\/|$)/.test(path)))
          context.report({ node, messageId: 'noImportDist', data: { path } })
      },
    }
  },
}

export const noImportNodeModulesByPath: PluginRule = {
  meta: {
    type: 'problem',
    schema: [],
    messages: {
      noImportNodeModulesByPath: 'Do not import modules in `node_modules` folder by path',
    },
  },
  create(context) {
    return {
      ImportDeclaration(node) {
        if (node.source.value.includes('/node_modules/'))
          context.report({ node, messageId: 'noImportNodeModulesByPath' })
      },
      CallExpression(node) {
        if (node.callee.type !== 'Identifier' || node.callee.name !== 'require') return
        const arg = node.arguments[0]
        if (
          arg?.type === 'Literal'
          && typeof arg.value === 'string'
          && arg.value.includes('/node_modules/')
        )
          context.report({ node, messageId: 'noImportNodeModulesByPath' })
      },
    }
  },
}
