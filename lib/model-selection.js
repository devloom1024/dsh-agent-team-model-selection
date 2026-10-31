/**
 * Pure model-selection rules for the Agent Teams tool plugin.
 *
 * The shipped Team tools always start a teammate on the Lead's LLM route. This
 * module turns one `spawn_teammate` call plus the plugin configuration into the
 * per-child Agent options the subagent runtime accepts, and renders model
 * catalog text for the model-facing discovery tool. Nothing here touches Cordis
 * or the LLM runtime, so the rules are testable in isolation.
 *
 * @module dsh-agent-team-model-selection/model-selection
 */

/** Deployment modes for a teammate's LLM route. */
export const MODEL_MODES = Object.freeze(['inherit', 'fixed']);

/** Defaults applied to an absent or partial `modelSelection` config object. */
export const DEFAULT_MODEL_SELECTION = Object.freeze({
  mode: 'inherit',
  provider: '',
  model: '',
  reasoningEffort: '',
  allowedModels: Object.freeze([]),
});

/** Trim a configured or requested text value, treating blank strings as absent. */
function text(value) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

/**
 * Normalize the loader-validated `modelSelection` config.
 *
 * `inherit` (shown as "自动" in the UI) follows the Lead and accepts per-spawn
 * route parameters; `fixed` pins every teammate and rejects them. `allowedModels`
 * is a whitelist for the model-facing choices in `inherit` mode only.
 *
 * @param {Record<string, unknown> | undefined} input - raw row config.
 * @returns the normalized selection policy.
 * @throws {Error} for an unsupported mode or a route list entry without ids.
 */
export function normalizeModelSelectionConfig(input = {}) {
  const mode = text(input.mode) ?? DEFAULT_MODEL_SELECTION.mode;
  if (!MODEL_MODES.includes(mode)) {
    throw new Error(`dsh-agent-team-model-selection: modelSelection.mode must be one of ${MODEL_MODES.join(', ')}, got "${mode}"`);
  }
  const allowedModels = Array.isArray(input.allowedModels) ? input.allowedModels : [];
  const normalizedAllowed = allowedModels.map((route) => {
    const provider = text(route?.provider);
    const model = text(route?.model);
    if (provider === undefined || model === undefined) {
      throw new Error('dsh-agent-team-model-selection: every modelSelection.allowedModels entry needs non-empty provider and model ids');
    }
    return { provider, model };
  });
  return {
    mode,
    provider: text(input.provider),
    model: text(input.model),
    reasoningEffort: text(input.reasoningEffort),
    allowedModels: normalizedAllowed,
  };
}

/**
 * Fail loud when a fixed deployment mode cannot name a route.
 *
 * Fixed mode exists to pin teammates to one route, so a half-configured row
 * would silently fall back to inheritance; activation rejects it instead.
 * The whitelist intentionally does not constrain this administrator-owned route.
 *
 * @param policy - normalized selection policy.
 * @returns the same policy for chaining.
 */
export function assertModelSelectionPolicy(policy) {
  if (policy.mode !== 'fixed') return policy;
  if (policy.provider === undefined || policy.model === undefined) {
    throw new Error('dsh-agent-team-model-selection: modelSelection.mode "fixed" requires modelSelection.provider and modelSelection.model');
  }
  return policy;
}

/**
 * Resolve one spawn call into per-child Agent options.
 *
 * `inherit` mode: no parameters follows the Lead (including later Lead model
 * switches); provider/model may pin one member, with the whitelist constraining
 * exactly those explicit route choices; reasoning_effort alone changes the
 * effort on the inherited route. `fixed` mode rejects every route parameter and
 * always uses the configured route.
 *
 * @param policy - normalized selection policy.
 * @param parentRoute - the Lead's current route, if known.
 * @param args - model-facing `spawn_teammate` arguments.
 * @returns `{ agentOptions, route }`, where `agentOptions` is the activation
 *   override (or undefined for pure inheritance) and `route` describes the
 *   effective route for the tool result.
 * @throws {Error} for pairing, emptiness, mode authority, or allowlist violations.
 */
export function resolveSpawnModel(policy, parentRoute, args) {
  const provider = text(args.provider);
  const model = text(args.model);
  const effort = text(args.reasoning_effort);
  const requestedRoute = provider !== undefined || model !== undefined;
  const requestedEffort = args.reasoning_effort !== undefined;

  if (requestedEffort && effort === undefined) throw new Error('reasoning_effort must be a non-empty id when supplied');
  if ((provider === undefined) !== (model === undefined)) throw new Error('provider and model must be supplied together');
  if (requestedRoute && (provider === undefined || model === undefined)) throw new Error('provider and model must be non-empty ids');

  if (policy.mode === 'fixed') {
    if (requestedRoute || requestedEffort) {
      throw new Error('fixed-route mode does not accept spawn route parameters; omit provider, model, and reasoning_effort');
    }
    if (policy.provider === undefined || policy.model === undefined) {
      throw new Error('fixed-route mode requires a configured provider and model');
    }
    const route = {
      provider: policy.provider,
      model: policy.model,
      ...policy.reasoningEffort === undefined ? {} : { reasoningEffort: policy.reasoningEffort },
    };
    return { agentOptions: { ...route }, route };
  }

  if (requestedRoute) {
    if (policy.allowedModels.length > 0 && !policy.allowedModels.some((allowed) => allowed.provider === provider && allowed.model === model)) {
      throw new Error(`LLM route "${provider}/${model}" is not allowed for this Session; call list_team_models to see allowed routes`);
    }
    const route = { provider, model, ...effort === undefined ? {} : { reasoningEffort: effort } };
    return { agentOptions: { provider, model, ...effort === undefined ? {} : { reasoningEffort: effort } }, route };
  }

  if (requestedEffort) {
    if (parentRoute?.provider === undefined || parentRoute?.model === undefined) {
      throw new Error('cannot override reasoning effort without an effective inherited route');
    }
    return { agentOptions: { reasoningEffort: effort }, route: { ...parentRoute, reasoningEffort: effort } };
  }

  return {
    agentOptions: undefined,
    route: parentRoute === undefined || parentRoute.provider === undefined || parentRoute.model === undefined
      ? undefined
      : { ...parentRoute },
  };
}

/** Render one provider line for the catalog tool. */
export function formatProviderLine(provider) {
  return `${provider.id} — ${provider.name}`;
}

/** Render one model line for the catalog tool. */
export function formatModelLine(providerId, model) {
  return `${providerId}/${model.id} — ${model.name}${model.description === undefined ? '' : `: ${model.description}`}`;
}

/** Render the reasoning efforts of one exact model, marking the adapter default. */
export function formatReasoningEfforts(model) {
  const efforts = model.reasoning?.efforts ?? [];
  if (efforts.length === 0) return '(no advertised reasoning efforts)';
  return efforts
    .map((effort) => `${effort.id}${model.reasoning?.defaultEffort === effort.id ? ' (default)' : ''} — ${effort.name}${effort.description === undefined ? '' : `: ${effort.description}`}`)
    .join('\n');
}

/** Whether a provider/model pair passes the deployment allowlist. */
export function isAllowedRoute(policy, providerId, modelId) {
  return policy.allowedModels.length === 0
    || policy.allowedModels.some((route) => route.provider === providerId && route.model === modelId);
}

/** Unwrap one loader config value: volatile settings fields arrive as `{ get() }` refs. */
function unwrapConfigValue(value) {
  return value !== null && typeof value === 'object' && typeof value.get === 'function' ? value.get() : value
}

/**
 * Read the live model-selection section from a plugin config.
 *
 * Cordis resolves every schema-declared volatile field to a getter ref, so the
 * Settings page's writes are visible here on the next call while ordinary
 * config values stay plain. Unwrapping both shapes keeps the same reader usable
 * in tests and deployments without the settings service.
 *
 * @param config - plugin config as delivered to `apply`.
 * @returns the normalized selection policy.
 * @throws {Error} for an unsupported mode or malformed allowlist entries.
 */
export function readModelSelectionConfig(config) {
  const section = unwrapConfigValue(config?.modelSelection) ?? {}
  return normalizeModelSelectionConfig({
    mode: unwrapConfigValue(section.mode),
    provider: unwrapConfigValue(section.provider),
    model: unwrapConfigValue(section.model),
    reasoningEffort: unwrapConfigValue(section.reasoningEffort),
    allowedModels: unwrapConfigValue(section.allowedModels) ?? [],
  })
}
