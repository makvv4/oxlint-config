import type { RuleTester } from 'oxlint/plugins-dev'

export type PluginRule = Parameters<RuleTester['run']>[1]
export type PluginContext = Parameters<NonNullable<PluginRule['create']>>[0]
export type PluginNode = Parameters<PluginContext['sourceCode']['getScope']>[0]
export type NodeOf<T extends PluginNode['type']> = Extract<PluginNode, { type: T }>
