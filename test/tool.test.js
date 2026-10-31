import test from 'node:test'
import assert from 'node:assert/strict'
import { compileParameters, compileValue, defineTool, validateArguments } from '../lib/tool.js'

test('compileParameters lifts required flags and drops the author-only key', () => {
  const schema = compileParameters({
    name: { type: 'string', required: true, description: 'Name.' },
    limit: { type: 'integer' },
    mode: { type: 'string', enum: ['a', 'b'] },
    tags: { type: 'array', items: { type: 'string' } },
    nested: {
      type: 'object',
      additionalProperties: false,
      properties: { ok: { type: 'boolean', required: true, const: true } },
    },
  })
  assert.deepEqual(schema, {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Name.' },
      limit: { type: 'integer' },
      mode: { type: 'string', enum: ['a', 'b'] },
      tags: { type: 'array', items: { type: 'string' } },
      nested: {
        type: 'object',
        additionalProperties: false,
        properties: { ok: { type: 'boolean', const: true } },
        required: ['ok'],
      },
    },
    required: ['name'],
  })
  assert.equal('required' in schema.properties.name, false)
  assert.equal(compileValue({ type: 'object' }).properties !== undefined, true)
})

test('validateArguments reports required, type, enum, and unknown-property violations', () => {
  const schema = compileParameters({
    name: { type: 'string', required: true },
    context: { type: 'string', enum: ['fresh', 'fork'] },
    timeout_ms: { type: 'integer' },
  })
  assert.deepEqual(validateArguments(schema, { name: 'a', context: 'fresh', timeout_ms: 1000 }), [])
  assert.deepEqual(validateArguments(schema, {}), ['"name" is required'])
  assert.deepEqual(validateArguments(schema, { name: 1 }), ['"name" must be a string'])
  assert.deepEqual(validateArguments(schema, { name: 'a', context: 'bad' }), ['"context" must be one of ["fresh","fork"]'])
  assert.deepEqual(validateArguments(schema, { name: 'a', timeout_ms: 1.5 }), ['"timeout_ms" must be an integer'])
  assert.deepEqual(validateArguments(schema, []), ['"arguments" must be an object'])
  const closed = compileParameters({ nested: { type: 'object', additionalProperties: false, properties: { ok: { type: 'string' } } } })
  assert.deepEqual(validateArguments(closed, { nested: { extra: 1 } }), ['"nested.extra" is not a supported argument'])
})

test('array items and nested paths are validated', () => {
  const schema = compileParameters({ blocked_by: { type: 'array', items: { type: 'string' } } })
  assert.deepEqual(validateArguments(schema, { blocked_by: ['a', 'b'] }), [])
  assert.deepEqual(validateArguments(schema, { blocked_by: ['a', 2] }), ['"blocked_by.1" must be a string'])
  assert.deepEqual(validateArguments(schema, { blocked_by: 'a' }), ['"blocked_by" must be an array'])
})

test('defineTool compiles both schemas and rejects invalid arguments before execute', async () => {
  let calls = 0
  const tool = defineTool({
    name: 'probe',
    description: 'Probe.',
    parameters: { value: { type: 'string', required: true } },
    output: { schema: { type: 'string' }, render: (_args, value) => [{ type: 'text', text: value }] },
    execute(args) {
      calls += 1
      return args.value
    },
  })
  assert.equal(tool.parameters.type, 'object')
  assert.deepEqual(tool.output.schema, { type: 'string' })
  assert.deepEqual(tool.output.render({}, 'x'), [{ type: 'text', text: 'x' }])
  await assert.rejects(tool.execute({}, {}), /invalid arguments: "value" is required/)
  assert.equal(calls, 0)
  assert.equal(await tool.execute({ value: 'ok' }, {}), 'ok')
  assert.equal(calls, 1)
})
