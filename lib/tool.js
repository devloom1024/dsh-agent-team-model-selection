/**
 * Dependency-free tool helper for the Agent Teams route plugin.
 *
 * The shipped Team tool plugin imports `defineTool` from `@deepseek-ai/dsh-tools`.
 * A profile-installed bundle links its checkout, and bare imports from a linked
 * checkout do not resolve to the running installation, so this module provides
 * the same contract locally: compile the compact parameter DSL into JSON Schema
 * and validate model-supplied arguments before `execute` runs.
 *
 * @module dsh-agent-team-model-selection/tool
 */

/** Format one argument path for a validation message. */
function pathOf(parent, key) {
  return parent === '' ? String(key) : `${parent}.${key}`
}

/**
 * Compile one compact value spec into raw JSON Schema.
 *
 * The spec uses `required: true` inside a property, which becomes an entry in
 * the parent object's `required` array, exactly like `@deepseek-ai/dsh-tools`.
 *
 * @param {Record<string, any>} spec - compact spec node.
 * @returns {Record<string, any>} raw JSON Schema node.
 */
export function compileValue(spec) {
  const schema = { type: spec.type }
  if (spec.description !== undefined) schema.description = spec.description
  if (spec.enum !== undefined) schema.enum = [...spec.enum]
  if (spec.const !== undefined) schema.const = spec.const
  if (spec.type === 'object') {
    const properties = {}
    const required = []
    for (const [key, child] of Object.entries(spec.properties ?? {})) {
      properties[key] = compileValue(child)
      if (child.required === true) required.push(key)
    }
    schema.properties = properties
    if (required.length > 0) schema.required = required
    if (spec.additionalProperties !== undefined) schema.additionalProperties = spec.additionalProperties
  }
  if (spec.type === 'array') schema.items = compileValue(spec.items)
  return schema
}

/**
 * Compile a compact per-property parameter map into an object-rooted schema.
 * @param {Record<string, any>} spec - parameter map.
 * @returns {Record<string, any>} raw JSON Schema.
 */
export function compileParameters(spec) {
  return compileValue({ type: 'object', properties: spec ?? {} })
}

/**
 * Validate one model-supplied argument object against a compiled schema.
 * @param {Record<string, any>} schema - compiled schema.
 * @param {unknown} value - candidate arguments.
 * @returns {string[]} violations; empty means valid.
 */
export function validateArguments(schema, value) {
  const issues = []
  check(schema, value, '', issues)
  return issues
}

/** Recursively collect violations for the supported schema subset. */
function check(schema, value, path, issues) {
  if (schema === undefined || schema === true) return
  if (schema.type === 'object') {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      issues.push(`"${path === '' ? 'arguments' : path}" must be an object`)
      return
    }
    for (const key of schema.required ?? []) {
      if (!Object.hasOwn(value, key)) issues.push(`"${pathOf(path, key)}" is required`)
    }
    for (const [key, child] of Object.entries(schema.properties ?? {})) {
      if (Object.hasOwn(value, key)) check(child, value[key], pathOf(path, key), issues)
    }
    if (schema.additionalProperties === false) {
      for (const key of Object.keys(value)) {
        if (!Object.hasOwn(schema.properties ?? {}, key)) issues.push(`"${pathOf(path, key)}" is not a supported argument`)
      }
    }
  } else if (schema.type === 'array') {
    if (!Array.isArray(value)) {
      issues.push(`"${path === '' ? 'arguments' : path}" must be an array`)
    } else {
      value.forEach((item, index) => check(schema.items, item, pathOf(path, index), issues))
    }
  } else if (schema.type === 'string') {
    if (typeof value !== 'string') issues.push(`"${path === '' ? 'arguments' : path}" must be a string`)
  } else if (schema.type === 'integer') {
    if (!Number.isSafeInteger(value)) issues.push(`"${path === '' ? 'arguments' : path}" must be an integer`)
  } else if (schema.type === 'number') {
    if (typeof value !== 'number' || !Number.isFinite(value)) issues.push(`"${path === '' ? 'arguments' : path}" must be a number`)
  } else if (schema.type === 'boolean') {
    if (typeof value !== 'boolean') issues.push(`"${path === '' ? 'arguments' : path}" must be a boolean`)
  }
  if (schema.enum !== undefined && !schema.enum.includes(value)) {
    issues.push(`"${path === '' ? 'arguments' : path}" must be one of ${JSON.stringify(schema.enum)}`)
  }
  if (schema.const !== undefined && value !== schema.const) {
    issues.push(`"${path === '' ? 'arguments' : path}" must be ${JSON.stringify(schema.const)}`)
  }
}

/**
 * Define one registry-ready tool with compiled schemas and argument validation.
 *
 * @param {object} options - tool declaration.
 * @param {string} options.name - model-facing tool name.
 * @param {string} options.description - model-facing description.
 * @param {Record<string, any>} options.parameters - compact parameter map.
 * @param {{ schema: Record<string, any>, render: (args: any, value: any) => any[] }} options.output - result declaration.
 * @param {(args: any, exec: any) => any} options.execute - tool body.
 * @returns the tool definition accepted by `ctx.tools.register`.
 */
export function defineTool(options) {
  const parameters = compileParameters(options.parameters)
  const output = {
    schema: compileValue(options.output.schema),
    render: options.output.render,
  }
  return {
    name: options.name,
    description: options.description,
    parameters,
    output,
    async execute(args, exec) {
      const issues = validateArguments(parameters, args)
      if (issues.length > 0) throw new Error(`invalid arguments: ${issues.join('; ')}`)
      return await options.execute(args, exec)
    },
  }
}
