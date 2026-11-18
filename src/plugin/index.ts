import type { PluginRule } from './types.js'
import { noImportDist, noImportNodeModulesByPath } from './import-paths.js'
import { noLocationAssignRelativeDestination } from './next-location.js'

const plugin: { meta: { name: string }; rules: Record<string, PluginRule> } = {
  meta: { name: 'makvv4' },
  rules: {
    'no-import-dist': noImportDist,
    'no-import-node-modules-by-path': noImportNodeModulesByPath,
    'no-location-assign-relative-destination': noLocationAssignRelativeDestination,
  },
}

export default plugin
