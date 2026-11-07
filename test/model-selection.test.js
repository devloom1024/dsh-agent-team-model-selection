import test from 'node:test'
import assert from 'node:assert/strict'
import {
  DEFAULT_MODEL_SELECTION,
  assertModelSelectionPolicy,
  formatModelLine,
  formatProviderLine,
  formatReasoningEfforts,
  isAllowedRoute,
  normalizeModelSelectionConfig,
  readModelSelectionConfig,
  resolveSpawnModel,
} from '../lib/model-selection.js'

const auto = normalizeModelSelectionConfig({})
const parent = { provider: 'lead-provider', model: 'lead-model', reasoningEffort: 'high' }

test('normalizeModelSelectionConfig restores defaults and drops blank strings', () => {
  assert.deepEqual(auto, {
    mode: 'inherit',
    provider: undefined,
    model: undefined,
    reasoningEffort: undefined,
    allowedModels: [],
  })
  assert.equal(DEFAULT_MODEL_SELECTION.mode, 'inherit')
  assert.throws(() => normalizeModelSelectionConfig({ mode: 'bogus' }), /mode must be one of/)
  assert.throws(() => normalizeModelSelectionConfig({ allowedModels: [{ provider: 'p' }] }), /needs non-empty provider and model/)
  // A legacy `allowModelOverride` key is ignored rather than rejected.
  assert.deepEqual(normalizeModelSelectionConfig({ allowModelOverride: false }).allowedModels, [])
})

test('a fixed policy needs a complete route; its whitelist does not gate the route', () => {
  assert.throws(() => assertModelSelectionPolicy(normalizeModelSelectionConfig({ mode: 'fixed', provider: 'p' })), /requires modelSelection.provider and modelSelection.model/)
  const fixed = normalizeModelSelectionConfig({
    mode: 'fixed', provider: 'p', model: 'm', allowedModels: [{ provider: 'x', model: 'y' }],
  })
  assert.equal(assertModelSelectionPolicy(fixed), fixed)
  const autoPolicy = normalizeModelSelectionConfig({ allowedModels: [{ provider: 'p', model: 'm' }] })
  assert.equal(assertModelSelectionPolicy(autoPolicy), autoPolicy)
})

test('auto mode: no arguments is pure inheritance of the Lead route', () => {
  assert.deepEqual(resolveSpawnModel(auto, parent, {}), { agentOptions: undefined, route: parent })
})

test('auto mode: explicit route and effort reach the child Agent options', () => {
  assert.deepEqual(resolveSpawnModel(auto, parent, { provider: 'p', model: 'm', reasoning_effort: 'low' }), {
    agentOptions: { provider: 'p', model: 'm', reasoningEffort: 'low' },
    route: { provider: 'p', model: 'm', reasoningEffort: 'low' },
  })
})

test('auto mode: an explicit route without effort clears the inherited effort', () => {
  assert.deepEqual(resolveSpawnModel(auto, parent, { provider: 'p', model: 'm' }), {
    agentOptions: { provider: 'p', model: 'm' },
    route: { provider: 'p', model: 'm' },
  })
})

test('auto mode: effort-only overrides the effort on the inherited route', () => {
  assert.deepEqual(resolveSpawnModel(auto, parent, { reasoning_effort: 'max' }), {
    agentOptions: { reasoningEffort: 'max' },
    route: { provider: 'lead-provider', model: 'lead-model', reasoningEffort: 'max' },
  })
})

test('auto mode: route pairing and emptiness are enforced', () => {
  assert.throws(() => resolveSpawnModel(auto, parent, { provider: 'p' }), /provider and model must be supplied together/)
  assert.throws(() => resolveSpawnModel(auto, parent, { model: 'm' }), /provider and model must be supplied together/)
  assert.throws(() => resolveSpawnModel(auto, parent, { provider: ' ', model: 'm' }), /provider and model must be supplied together/)
  assert.throws(() => resolveSpawnModel(auto, parent, { reasoning_effort: '' }), /non-empty id when supplied/)
  assert.throws(() => resolveSpawnModel(auto, undefined, { reasoning_effort: 'max' }), /without an effective inherited route/)
})

test('auto mode: the whitelist bounds the effective route, including inheritance', () => {
  const policy = normalizeModelSelectionConfig({ allowedModels: [{ provider: 'p', model: 'm' }] })
  assert.equal(isAllowedRoute(policy, 'p', 'm'), true)
  assert.equal(isAllowedRoute(policy, 'p', 'other'), false)
  assert.deepEqual(resolveSpawnModel(policy, parent, { provider: 'p', model: 'm' }).agentOptions, { provider: 'p', model: 'm' })
  assert.throws(() => resolveSpawnModel(policy, parent, { provider: 'p', model: 'other' }), /allowed routes: p\/m/)
  // An unlisted Lead route may no longer be inherited, because the member would run outside the whitelist.
  assert.throws(() => resolveSpawnModel(policy, parent, {}), /inherited Lead route "lead-provider\/lead-model" is not allowed/)
  assert.throws(() => resolveSpawnModel(policy, parent, { reasoning_effort: 'max' }), /cannot apply reasoning_effort to the inherited route/)
  // A listed Lead route may still be inherited, with or without an effort override.
  const listedParent = { provider: 'p', model: 'm', reasoningEffort: 'low' }
  assert.deepEqual(resolveSpawnModel(policy, listedParent, {}), { agentOptions: undefined, route: listedParent })
  assert.deepEqual(resolveSpawnModel(policy, listedParent, { reasoning_effort: 'max' }), {
    agentOptions: { reasoningEffort: 'max' },
    route: { provider: 'p', model: 'm', reasoningEffort: 'max' },
  })
  // An unknown Lead route cannot be verified against the whitelist.
  assert.throws(() => resolveSpawnModel(policy, undefined, {}), /cannot inherit the Lead route because it is unknown/)
})

test('fixed mode: always uses the configured route and rejects every spawn parameter', () => {
  const policy = assertModelSelectionPolicy(normalizeModelSelectionConfig({
    mode: 'fixed', provider: 'fp', model: 'fm', reasoningEffort: 'high',
    allowedModels: [{ provider: 'x', model: 'y' }],
  }))
  assert.deepEqual(resolveSpawnModel(policy, parent, {}), {
    agentOptions: { provider: 'fp', model: 'fm', reasoningEffort: 'high' },
    route: { provider: 'fp', model: 'fm', reasoningEffort: 'high' },
  })
  assert.throws(() => resolveSpawnModel(policy, parent, { provider: 'p', model: 'm' }), /fixed-route mode does not accept spawn route parameters/)
  assert.throws(() => resolveSpawnModel(policy, parent, { reasoning_effort: 'low' }), /fixed-route mode does not accept spawn route parameters/)
  assert.throws(() => resolveSpawnModel(policy, parent, { provider: 'p' }), /provider and model must be supplied together/)
})

test('fixed mode: an absent effort means the model default', () => {
  const policy = assertModelSelectionPolicy(normalizeModelSelectionConfig({ mode: 'fixed', provider: 'fp', model: 'fm' }))
  assert.deepEqual(resolveSpawnModel(policy, parent, {}), {
    agentOptions: { provider: 'fp', model: 'fm' },
    route: { provider: 'fp', model: 'fm' },
  })
})

test('readModelSelectionConfig unwraps volatile settings refs and plain config alike', () => {
  const getter = (value) => ({ get: () => value })
  const plain = readModelSelectionConfig({
    modelSelection: { mode: 'fixed', provider: 'p', model: 'm', reasoningEffort: 'high', allowedModels: [{ provider: 'p', model: 'm' }] },
  })
  assert.deepEqual(plain, {
    mode: 'fixed',
    provider: 'p',
    model: 'm',
    reasoningEffort: 'high',
    allowedModels: [{ provider: 'p', model: 'm' }],
  })
  const live = readModelSelectionConfig({
    modelSelection: {
      mode: getter('inherit'),
      provider: getter(''),
      model: getter(''),
      reasoningEffort: getter('max'),
      allowedModels: getter([]),
    },
  })
  assert.deepEqual(live, {
    mode: 'inherit',
    provider: undefined,
    model: undefined,
    reasoningEffort: 'max',
    allowedModels: [],
  })
  assert.equal(readModelSelectionConfig(undefined).mode, 'inherit')
})

test('catalog formatting stays compact and marks the default effort', () => {
  assert.equal(formatProviderLine({ id: 'p', name: 'Provider' }), 'p — Provider')
  assert.equal(formatModelLine('p', { id: 'm', name: 'Model' }), 'p/m — Model')
  assert.equal(formatModelLine('p', { id: 'm', name: 'Model', description: 'fast' }), 'p/m — Model: fast')
  assert.equal(
    formatReasoningEfforts({ reasoning: { defaultEffort: 'high', efforts: [{ id: 'low', name: 'Low' }, { id: 'high', name: 'High' }] } }),
    'low — Low\nhigh (default) — High',
  )
  assert.equal(formatReasoningEfforts({}), '(no advertised reasoning efforts)')
})
