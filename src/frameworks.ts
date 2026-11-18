import type { OxlintConfig } from 'oxlint'
import { existsSync } from 'node:fs'
import { findPackageJSON } from 'node:module'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

type Rules = NonNullable<OxlintConfig['rules']>

const refreshPackages = {
  'vite': ['vite'],
  'remix': ['@remix-run/node', '@remix-run/react', '@remix-run/serve', '@remix-run/dev'],
  'react-router': [
    '@react-router/node',
    '@react-router/react',
    '@react-router/serve',
    '@react-router/dev',
  ],
  'next': ['next'],
}

export interface ReactPresetOptions {
  rootDir?: string
  fastRefresh?: readonly (keyof typeof refreshPackages)[]
}

function detectRefreshIntegrations(rootDir = '.') {
  const base = pathToFileURL(resolve(rootDir, 'package.json'))
  const isInstalled = (name: string) => {
    try {
      const manifest = findPackageJSON(name, base)
      return manifest !== undefined && existsSync(manifest)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ERR_MODULE_NOT_FOUND') return false
      throw error
    }
  }
  return (Object.keys(refreshPackages) as (keyof typeof refreshPackages)[]).filter(integration =>
    refreshPackages[integration].some(isInstalled),
  )
}

const nextRefreshExports = [
  'dynamic',
  'dynamicParams',
  'revalidate',
  'fetchCache',
  'runtime',
  'preferredRegion',
  'maxDuration',
  'generateStaticParams',
  'metadata',
  'generateMetadata',
  'viewport',
  'generateViewport',
  'generateImageMetadata',
  'generateSitemaps',
]

const routerRefreshExports = [
  'meta',
  'links',
  'headers',
  'loader',
  'action',
  'clientLoader',
  'clientAction',
  'handle',
  'shouldRevalidate',
]

export function createReactRules(options: ReactPresetOptions, nextjs: boolean): Rules {
  const integrations = options.fastRefresh ?? detectRefreshIntegrations(options.rootDir)
  return {
    'react/error-boundaries': 'error',
    'react/exhaustive-deps': 'warn',
    'react/hook-use-state': 'warn',
    'react/jsx-key': ['error', { warnOnDuplicates: false }],
    'react/jsx-no-comment-textnodes': 'warn',
    'react/jsx-no-script-url': 'warn',
    'react/no-array-index-key': 'warn',
    'react/no-children-prop': 'warn',
    'react/no-clone-element': 'warn',
    'react/no-danger': 'warn',
    'react/no-danger-with-children': 'error',
    'react/no-did-mount-set-state': 'warn',
    'react/no-did-update-set-state': 'warn',
    'react/no-direct-mutation-state': 'error',
    'react/no-find-dom-node': 'error',
    'react/no-namespace': 'error',
    'react/no-react-children': 'warn',
    'react/no-render-return-value': 'error',
    'react/no-unsafe': ['warn', { checkAliases: true }],
    'react/no-unstable-nested-components': 'error',
    'react/no-will-update-set-state': 'warn',
    'react/only-export-components': [
      'error',
      {
        allowConstantExport: integrations.includes('vite'),
        allowExportNames: [
          ...(nextjs || integrations.includes('next') ? nextRefreshExports : []),
          ...(integrations.includes('remix') || integrations.includes('react-router')
            ? routerRefreshExports
            : []),
        ],
      },
    ],
    'react/purity': 'warn',
    'react/rules-of-hooks': 'error',
    'react/set-state-in-effect': 'warn',
    'react/set-state-in-render': 'error',
    'react/static-components': 'error',
    'react/unsupported-syntax': 'error',
    'react/use-memo': 'error',
    'react/void-dom-elements-no-children': 'error',
  }
}

export const nextjsRules: Rules = {
  'nextjs/google-font-display': 'warn',
  'nextjs/google-font-preconnect': 'warn',
  'nextjs/inline-script-id': 'error',
  'nextjs/next-script-for-ga': 'warn',
  'nextjs/no-assign-module-variable': 'error',
  'nextjs/no-async-client-component': 'warn',
  'nextjs/no-before-interactive-script-outside-document': 'warn',
  'nextjs/no-css-tags': 'warn',
  'nextjs/no-document-import-in-page': 'error',
  'nextjs/no-duplicate-head': 'error',
  'nextjs/no-head-element': 'warn',
  'nextjs/no-head-import-in-document': 'error',
  'nextjs/no-html-link-for-pages': 'error',
  'nextjs/no-img-element': 'warn',
  'nextjs/no-page-custom-font': 'warn',
  'nextjs/no-script-component-in-head': 'error',
  'nextjs/no-styled-jsx-in-document': 'warn',
  'nextjs/no-sync-scripts': 'error',
  'nextjs/no-title-in-document-head': 'warn',
  'nextjs/no-typos': 'warn',
  'nextjs/no-unwanted-polyfillio': 'warn',
}
