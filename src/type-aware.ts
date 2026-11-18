import type { OxlintConfig } from 'oxlint'

// Native equivalents of Antfu 10.0.0's opt-in type-aware TypeScript rules.
// Adapted under the MIT license; see THIRD_PARTY_NOTICES.
export const typeAwareRules: NonNullable<OxlintConfig['rules']> = {
  'dot-notation': 'off',
  'no-implied-eval': 'off',
  'typescript/await-thenable': 'error',
  'typescript/dot-notation': ['error', { allowKeywords: true }],
  'typescript/no-floating-promises': 'error',
  'typescript/no-for-in-array': 'error',
  'typescript/no-implied-eval': 'error',
  'typescript/no-misused-promises': 'error',
  'typescript/no-unnecessary-type-assertion': 'error',
  'typescript/no-unsafe-argument': 'error',
  'typescript/no-unsafe-assignment': 'error',
  'typescript/no-unsafe-call': 'error',
  'typescript/no-unsafe-member-access': 'error',
  'typescript/no-unsafe-return': 'error',
  'typescript/promise-function-async': 'error',
  'typescript/restrict-plus-operands': 'error',
  'typescript/restrict-template-expressions': 'error',
  'typescript/return-await': ['error', 'in-try-catch'],
  'typescript/strict-boolean-expressions': [
    'error',
    { allowNullableBoolean: true, allowNullableObject: true },
  ],
  'typescript/switch-exhaustiveness-check': 'error',
  'typescript/unbound-method': 'error',
}
