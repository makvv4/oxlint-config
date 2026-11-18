import type { NodeOf, PluginContext, PluginNode, PluginRule } from './types.js'

const locationOwners = new Set(['window', 'globalThis', 'document', 'self'])
const absoluteDestination = /^(?:[a-z][a-z\d+.-]*:|\/\/)/i

function isMember(node: PluginNode, name: string): node is NodeOf<'MemberExpression'> {
  return (
    node.type === 'MemberExpression'
    && (node.computed
      ? node.property.type === 'Literal' && node.property.value === name
      : node.property.type === 'Identifier' && node.property.name === name)
  )
}

function isBrowserLocation(node: PluginNode, source: PluginContext['sourceCode']): boolean {
  if (node.type === 'Identifier') return node.name === 'location' && source.isGlobalReference(node)
  return (
    isMember(node, 'location')
    && node.object.type === 'Identifier'
    && locationOwners.has(node.object.name)
    && source.isGlobalReference(node.object)
  )
}

type Source = PluginContext['sourceCode']
type Binding = NonNullable<ReturnType<typeof bindingOf>>

function bindingOf(node: NodeOf<'Identifier'>, source: Source) {
  for (
    let scope: ReturnType<Source['getScope']> | null = source.getScope(node);
    scope;
    scope = scope.upper
  ) {
    const binding = scope.set.get(node.name)
    if (binding) return binding
  }
  return null
}

function latestAssignment(binding: Binding, node: NodeOf<'Identifier'>) {
  const def = binding.defs.at(-1)
  if (def?.type !== 'Variable' || def.node.type !== 'VariableDeclarator') return
  let value = def.node.init
  for (const ref of binding.references) {
    if (ref.identifier.start >= node.start) break
    if (ref.isWrite() && ref.writeExpr) value = ref.writeExpr
  }
  return value
}

function memberName(node: NodeOf<'MemberExpression'>): string | undefined {
  if (!node.computed && node.property.type === 'Identifier') return node.property.name
  if (node.computed && node.property.type === 'Literal') return String(node.property.value)
}

function hasMemberWrite(binding: Binding): boolean {
  return binding.references.some(({ identifier }) => {
    let node: PluginNode = identifier
    while (node.parent.type === 'MemberExpression' && node.parent.object === node)
      node = node.parent
    return (
      (node.parent.type === 'AssignmentExpression' && node.parent.left === node)
      || (node.parent.type === 'UpdateExpression' && node.parent.argument === node)
      || (node.parent.type === 'CallExpression'
        && node.parent.callee === node
        && node.type === 'MemberExpression')
    )
  })
}

type Value = string | number | boolean | bigint | null | ReadonlyMap<string, Value>

function destinationPrefix(input: PluginNode, source: Source): string | undefined {
  // Bound work even when aliases form a cycle or reference one another many times.
  let remaining = 256
  const consume = () => remaining-- > 0

  // Fold data literals, without executing user code, getters or methods.
  function constant(node: PluginNode): Value | undefined {
    if (!consume()) return
    switch (node.type) {
      case 'Literal':
        return node.value instanceof RegExp ? String(node.value) : node.value
      case 'Identifier': {
        const binding = bindingOf(node, source)
        const def = binding?.defs[0]
        if (
          !binding
          || def?.node.type !== 'VariableDeclarator'
          || def.node.id.type !== 'Identifier'
          || !def.node.init
        )
          return
        if (binding.references.some(ref => ref.isWrite() && !ref.init)) return
        const value = constant(def.node.init)
        return value instanceof Map && hasMemberWrite(binding) ? undefined : value
      }
      case 'TSAsExpression':
      case 'TSSatisfiesExpression':
      case 'TSTypeAssertion':
      case 'TSNonNullExpression':
      case 'TSInstantiationExpression':
        return constant(node.expression)
      case 'TemplateLiteral': {
        let text = node.quasis[0].value.cooked ?? node.quasis[0].value.raw
        for (const [index, expr] of node.expressions.entries()) {
          const part = constant(expr)
          if (part === undefined || part instanceof Map) return
          const quasi = node.quasis[index + 1].value
          text += String(part) + (quasi.cooked ?? quasi.raw)
        }
        return text
      }
      case 'BinaryExpression': {
        if (node.operator !== '+') return
        const left = constant(node.left)
        const right = constant(node.right)
        if (
          left === undefined
          || right === undefined
          || left instanceof Map
          || right instanceof Map
        )
          return
        if (typeof left === 'string' || typeof right === 'string')
          return String(left) + String(right)
        if (typeof left === 'bigint' || typeof right === 'bigint') {
          return typeof left === 'bigint' && typeof right === 'bigint' ? left + right : undefined
        }
        return Number(left) + Number(right)
      }
      case 'ConditionalExpression': {
        const condition = constant(node.test)
        return condition === undefined
          ? undefined
          : constant(condition ? node.consequent : node.alternate)
      }
      case 'ArrayExpression':
      case 'ObjectExpression': {
        const values = new Map<string, Value>()
        if (node.type === 'ArrayExpression') {
          for (const [i, item] of node.elements.entries()) {
            if (!item || item.type === 'SpreadElement') return
            const value = constant(item)
            if (value === undefined) return
            values.set(String(i), value)
          }
        } else {
          for (const prop of node.properties) {
            if (prop.type !== 'Property' || prop.kind !== 'init') return
            const key =
              !prop.computed && prop.key.type === 'Identifier' ? prop.key.name : constant(prop.key)
            const value = constant(prop.value)
            if (key === undefined || key instanceof Map || value === undefined) return
            values.set(String(key), value)
          }
        }
        return values
      }
      case 'MemberExpression': {
        const object = constant(node.object)
        const key = memberName(node) ?? (node.computed ? constant(node.property) : undefined)
        if (object instanceof Map && key !== undefined && !(key instanceof Map))
          return object.get(String(key))
        return
      }
    }
  }

  // With a partially dynamic destination Next.js checks the leading quasi or left operand.
  while (consume()) {
    const value = constant(input)
    if (value !== undefined && !(value instanceof Map)) return String(value)
    if (input.type === 'TemplateLiteral')
      return input.quasis[0].value.cooked ?? input.quasis[0].value.raw
    if (input.type === 'BinaryExpression' && input.operator === '+') {
      input = input.left
      continue
    }
    if (input.type === 'Identifier') {
      const binding = bindingOf(input, source)
      const assignment = binding && latestAssignment(binding, input)
      if (assignment) {
        input = assignment
        continue
      }
    }
    return
  }
}

export const noLocationAssignRelativeDestination: PluginRule = {
  meta: {
    type: 'problem',
    docs: { description: 'Use the Next.js router to navigate within the application.' },
    schema: [],
    messages: {
      relative:
        'Use Next.js redirect() or router.push() for an internal destination instead of {{expression}}.',
    },
  },
  create(context) {
    const source = context.sourceCode
    function check(node: PluginNode, member: NodeOf<'MemberExpression'>, value: PluginNode) {
      if (!isBrowserLocation(member.object, source)) return
      const prefix = destinationPrefix(value, source)
      if (prefix === undefined || absoluteDestination.test(prefix)) return
      context.report({
        node,
        messageId: 'relative',
        data: { expression: source.getText(member) + (node.type === 'CallExpression' ? '()' : '') },
      })
    }
    return {
      CallExpression(node) {
        const [destination] = node.arguments
        if (
          destination
          && destination.type !== 'SpreadElement'
          && isMember(node.callee, 'assign')
        ) {
          check(node, node.callee, destination)
        }
      },
      AssignmentExpression(node) {
        if (isMember(node.left, 'href')) check(node, node.left, node.right)
      },
    }
  },
}
