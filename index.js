import { AsyncLocalStorage } from 'node:async_hooks'
import z from './lib/vendor/schemastery.js'
import { defineTool } from './lib/tool.js'
import {
  assertModelSelectionPolicy,
  formatModelLine,
  formatProviderLine,
  formatReasoningEfforts,
  isAllowedRoute,
  readModelSelectionConfig,
  resolveSpawnModel,
} from './lib/model-selection.js'

/** Cordis plugin name. */
export const name = 'tool-agent-team-model-selection'

/** Services required by the Team tool plugin and its activation route hook. */
export const inject = ['agents', 'agentTeams', 'tools', 'systemPrompt', 'subagents']

/**
 * Loader schema for the replacement Team tool plugin.
 *
 * `modelSelection` is the editable settings section: every leaf is volatile so
 * the Settings page can rewrite it through the profile patch and the running
 * plugin reads the new value on its next spawn without reloading. `inherit`
 * (shown as automatic) accepts per-spawn route parameters; `fixed` rejects them.
 * The remaining fields keep the shipped Team tool contract unchanged.
 */
export const Config = z.object({
  interrupt: z.boolean().default(true),
  freshProvider: z.string().default('spawn'),
  forkProvider: z.string().default('fork'),
  modelSelection: z.object({
    mode: z.union([z.const('inherit'), z.const('fixed')]).default('inherit').volatile(),
    provider: z.string().default('').volatile(),
    model: z.string().default('').volatile(),
    reasoningEffort: z.string().default('').volatile(),
    allowedModels: z.array(z.object({
      provider: z.string().min(1).required(),
      model: z.string().min(1).required(),
    })).default([]).volatile(),
  }).default({}),
})

/** Brand kept local because the Team domain brands task ids with an identity function. */
const TeamTaskId = (id) => id

/** Stable global slot for the per-spawn route store, shared across plugin reloads. */
const ROUTE_STORE = Symbol.for('dsh-agent-team-model-selection.pending-agent-options')
/** Marker proving that one function is this plugin's activation hook. */
const ROUTE_HOOK = Symbol.for('dsh-agent-team-model-selection.route-hook')
/** The function a hook delegates to, so a reload can replace a stale hook. */
const ROUTE_ORIGINAL = Symbol.for('dsh-agent-team-model-selection.route-original')
/** The store a hook reads, so a hook from another generation is replaced. */
const ROUTE_HOOK_STORE = Symbol.for('dsh-agent-team-model-selection.route-hook-store')

/**
 * The per-spawn route store.
 *
 * The Host may reload this plugin without disposing every generation's hook,
 * and a stale hook keeps its own module-level storage. Keying the store on
 * `globalThis` makes every generation share one store, so a surviving hook and
 * a freshly installed one read the same pending route.
 */
function routeStore() {
  return globalThis[ROUTE_STORE] ??= new AsyncLocalStorage()
}

/**
 * Teach `ctx.subagents.startActivation` to accept per-child Agent options.
 *
 * The Team domain creates teammates through the subagent runtime but cannot
 * pass a route itself. The route therefore travels with the creation call in
 * async-local storage and is merged into the activation spec at the seam.
 * Reinstalling replaces a stale hook from another module generation instead of
 * trusting its marker, keeping exactly one active wrapper per generation.
 */
function installActivationRouteHook(ctx) {
  const service = ctx.subagents
  const current = service.startActivation
  if (current[ROUTE_HOOK] === true && current[ROUTE_HOOK_STORE] === routeStore()) return () => {}
  const original = current[ROUTE_ORIGINAL] ?? current
  const hooked = function startActivation(spec) {
    const agentOptions = routeStore().getStore()
    return original.call(this, agentOptions === undefined
      ? spec
      : { ...spec, request: { ...spec.request, agentOptions } })
  }
  hooked[ROUTE_HOOK] = true
  hooked[ROUTE_ORIGINAL] = original
  hooked[ROUTE_HOOK_STORE] = routeStore()
  service.startActivation = hooked
  return () => {
    if (service.startActivation === hooked) service.startActivation = original
  }
}

/** Run one Team creation with its selected child route attached. */
function withAgentOptions(agentOptions, operation) {
  return agentOptions === undefined ? operation() : routeStore().run({ ...agentOptions }, operation)
}

/** Read one live Agent's current provider/model route, preferring its request header. */
function routeOf(agent) {
  const config = agent?.session?.requestHeader?.()?.config
  if (config?.provider !== undefined && config?.model !== undefined) {
    return {
      provider: config.provider,
      model: config.model,
      ...config.reasoningEffort === undefined ? {} : { reasoningEffort: config.reasoningEffort },
    }
  }
  const options = agent?.options ?? {}
  if (options.provider === undefined || options.model === undefined) return undefined
  return {
    provider: options.provider,
    model: options.model,
    ...options.reasoningEffort === undefined ? {} : { reasoningEffort: options.reasoningEffort },
  }
}

/** Reject an unusable route before any teammate session exists. */
async function assertRouteUsable(ctx, agentOptions, parentRoute, signal) {
  if (agentOptions === undefined) return
  const provider = agentOptions.provider ?? parentRoute?.provider
  const model = agentOptions.model ?? parentRoute?.model
  if (provider === undefined || model === undefined) {
    throw new Error('cannot select a teammate LLM route without an effective provider and model')
  }
  const llm = ctx.get('llm')
  if (llm === undefined) throw new Error('cannot select a teammate LLM route because the `llm` service is unavailable')
  await llm.resolveCallConfig({
    provider,
    model,
    ...agentOptions.reasoningEffort === undefined ? {} : { reasoningEffort: agentOptions.reasoningEffort },
  }, signal)
}

/** Model-facing description of the live route policy for the Team prompt. */
function routePolicyText(policy) {
  const unrestricted = 'When the deployment allows it, the Lead may pin a new teammate to another LLM route by passing provider, model, and reasoning_effort to spawn_teammate; discover usable ids with list_team_models.'
  if (policy === undefined) return unrestricted
  if (policy.mode === 'fixed') {
    return `Every new teammate runs on the fixed route ${policy.provider}/${policy.model}. spawn_teammate rejects provider, model, and reasoning_effort; do not pass them.`
  }
  if (policy.allowedModels.length > 0) {
    const routes = policy.allowedModels.map((route) => `${route.provider}/${route.model}`).join(', ')
    return `This Session allows teammates only on these LLM routes: ${routes}. A provider/model passed to spawn_teammate must be one of them, and a no-argument spawn is refused when the Lead route is not one of them; pass an allowed route explicitly. Discover ids with list_team_models.`
  }
  return unrestricted
}

/** Read the live policy for prompt rendering without breaking the turn on bad config. */
function safePolicy(getPolicy) {
  try {
    return getPolicy()
  } catch {
    return undefined
  }
}

/** Model-facing collaboration guidance shared by Lead and teammates. */
function teamPolicy(interrupt, getPolicy) {
  const routePolicy = routePolicyText(safePolicy(getPolicy))
  return `Agent Teams is available in this session

The Team Lead and all teammates share the same working directory and filesystem. Edits are immediately visible to every member. Split write work into disjoint scopes, record expected write scopes on shared tasks, and use task dependencies when work must be ordered. Write-scope overlap is advisory, not a lock.

Prefer read/edit/write for file changes. If a file operation returns FS_STALE_VERSION, read the current file, rebase your intended change onto the new content, and retry. Bash, formatters, code generators, and scripts are not fully protected by the filesystem version guard; coordinate them explicitly and have the Lead review the final diff and run tests.

Use the target returned by spawn_teammate or list_agents for send_message${interrupt ? ' and interrupt_agent' : ''}, or as owner when assigning or filtering shared tasks. send_message steers a running target at its nearest step boundary and starts or resumes an inactive target. inactive means no turn is executing; it does not describe task completion, success, failure, or waiting for other agents. provisioning means member creation is in progress; failed means member creation failed. A peer message starts with its sender name. A successful send does not mean the recipient has processed it. Shared-task workflow is list, get, claim with the current revision, perform the work, then complete. Task readiness never starts an owner. Before wait_agent, use list_agents and make sure another required member is running or provisioning; use send_message first when the required member is inactive. wait_agent observes only changes after that call starts, never wakes a member, and returns noProgress immediately when no other member can produce a change. Re-list after wakeup or timeout. The Lead must wait for required teammates before giving the final answer.

${routePolicy} Each member row reported by list_agents states the provider, model, and reasoning effort that member currently uses.`;
}

const ACTIVE_WAIT_STATUSES = new Set(['running', 'provisioning'])
const NO_ACTIVE_PEER_MESSAGE = 'No other Team member is running or provisioning. wait_agent cannot make progress or wake inactive teammates. Re-list with list_agents and team_task_list, then use send_message to wake each required inactive teammate before waiting again.'

const ROUTE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    provider: { type: 'string', required: true },
    model: { type: 'string', required: true },
    reasoningEffort: { type: 'string' },
  },
}

/**
 * One model-facing roster row. The Lead pseudo-row omits the teammate-only
 * provisioning fields, so only identity, role, status, and diagnostics are
 * required.
 */
const MEMBER_VIEW_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    target: { type: 'string', required: true },
    role: { type: 'string', required: true, enum: ['lead', 'teammate'] },
    status: {
      type: 'string',
      required: true,
      enum: ['running', 'inactive', 'provisioning', 'failed'],
    },
    description: { type: 'string' },
    provider: { type: 'string' },
    context: { type: 'string', enum: ['fresh', 'fork'] },
    model: { type: 'string' },
    llm: ROUTE_SCHEMA,
    diagnostics: { type: 'array', required: true, items: { type: 'string' } },
  },
}

/** Expose the member name as its model-facing target and add its LLM route. */
function modelMember(ctx, member) {
  const { id, name, ...details } = member
  const live = id === undefined ? undefined : ctx.agents.get(id)
  const route = live === undefined ? undefined : routeOf(live)
  return {
    target: name,
    ...details,
    ...route === undefined ? {} : { llm: route },
  }
}

/** One shared task, matching the public `TeamTaskView`. */
const TASK_VIEW_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    id: { type: 'string', required: true },
    revision: { type: 'integer', required: true },
    subject: { type: 'string', required: true },
    description: { type: 'string', required: true },
    status: {
      type: 'string',
      required: true,
      enum: ['pending', 'in_progress', 'completed', 'deleted'],
    },
    ownerName: { type: 'string' },
    blockedBy: { type: 'array', required: true, items: { type: 'string' } },
    writeScopes: { type: 'array', required: true, items: { type: 'string' } },
    ready: { type: 'boolean', required: true },
    writeScopeWarnings: { type: 'array', required: true, items: { type: 'string' } },
  },
}

const SPAWN_VALUE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    member: { ...MEMBER_VIEW_SCHEMA, required: true },
  },
}
const MEMBER_LIST_VALUE_SCHEMA = { type: 'array', items: MEMBER_VIEW_SCHEMA }
const SEND_VALUE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: { sent: { type: 'boolean', required: true, const: true } },
}
/** `noProgress` is present only on the model-only shortcut that skips the wait. */
const WAIT_VALUE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    timedOut: { type: 'boolean', required: true },
    noProgress: {
      type: 'object',
      additionalProperties: false,
      properties: {
        reason: { type: 'string', required: true, const: 'no-active-peer' },
        message: { type: 'string', required: true },
      },
    },
  },
}
const INTERRUPT_VALUE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    previousStatus: { type: 'string', required: true, enum: ['running', 'inactive'] },
  },
}
const TASK_LIST_VALUE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    tasks: { type: 'array', required: true, items: TASK_VIEW_SCHEMA },
    nextCursor: { type: 'integer' },
  },
}

/**
 * Declare one canonical output schema with compact model-facing JSON.
 * @param schema - canonical value schema for one tool.
 * @returns the `output` declaration accepted by {@link defineTool}.
 */
function jsonOutput(schema) {
  return {
    schema,
    render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }],
  }
}

/** Recover the exact caller guaranteed by Agent-scoped tool discovery. */
function callingAgent(agent, toolName) {
  if (agent === undefined) throw new Error(`${toolName} requires a calling Agent`)
  return agent
}

/** Read one optional non-empty model-catalog argument. */
function catalogText(value, field) {
  if (value === undefined) return undefined
  if (typeof value !== 'string' || value.length === 0) throw new Error(`\`${field}\` must be a non-empty id`)
  return value
}

/**
 * Render the routes available to a teammate: providers, one provider's models,
 * or one exact model's reasoning efforts.
 *
 * @param ctx - context owning the LLM service.
 * @param policy - normalized selection policy, whose allowlist filters the catalog.
 * @param request - model-facing catalog arguments.
 * @param signal - tool-call cancellation.
 * @returns newline-separated catalog text.
 */
async function listTeamModels(ctx, policy, request, signal) {
  const llm = ctx.get('llm')
  if (llm === undefined) throw new Error('cannot list LLM routes because the `llm` service is unavailable')
  const providerId = catalogText(request.provider, 'provider')
  const modelId = catalogText(request.model, 'model')
  if (modelId !== undefined && providerId === undefined) throw new Error('`model` requires `provider`')

  const providers = llm.listProviders()
  if (providerId === undefined) {
    const allowed = providers.filter((provider) => policy.allowedModels.length === 0
      || policy.allowedModels.some((route) => route.provider === provider.id))
    return allowed.length === 0 ? '(no LLM providers)' : allowed.map((provider) => formatProviderLine(provider)).join('\n')
  }
  if (!providers.some((provider) => provider.id === providerId)) {
    const available = providers.map((provider) => provider.id).join(', ') || '(none)'
    throw new Error(`LLM provider "${providerId}" is not registered; available providers: ${available}`)
  }
  const providerRoutes = policy.allowedModels.filter((route) => route.provider === providerId)
  if (policy.allowedModels.length > 0 && providerRoutes.length === 0) {
    throw new Error(`LLM provider "${providerId}" is not allowed for this Session`)
  }
  if (modelId === undefined) {
    const models = await llm.listModels(providerId)
    const allowed = models.filter((model) => isAllowedRoute(policy, providerId, model.id))
    return allowed.length === 0 ? `(no advertised models for ${providerId})` : allowed.map((model) => formatModelLine(providerId, model)).join('\n')
  }
  if (!isAllowedRoute(policy, providerId, modelId)) {
    throw new Error(`LLM route "${providerId}/${modelId}" is not allowed for this Session`)
  }
  const model = await llm.resolveModelInfo(providerId, modelId, signal)
  return `${formatModelLine(providerId, model)}\nReasoning efforts:\n${formatReasoningEfforts(model)}`
}

/** Register the complete Team tool set in one exact Agent scope. */
function install(agent, ctx, config, getPolicy) {
  const scoped = agent.ctx
  const disposers = []
  const register = (disposer) => {
    disposers.push(disposer)
  }
  try {
    register(scoped.systemPrompt.section({
      name: 'team:policy',
      order: scoped.systemPrompt.getSectionOrder('TEAM_POLICY'),
      text: () => teamPolicy(config.interrupt, getPolicy),
    }))
    register(scoped.systemPrompt.context({
      name: 'team:identity',
      order: scoped.systemPrompt.getContextOrder('TEAM_IDENTITY'),
      required: true,
      text: () => {
        const { role, name } = ctx.agentTeams.membership(agent)
        return `${role === 'lead' ? 'You are the Team Lead named "lead".' : `You are teammate "${name}".\nYour Team Lead is named "lead".\nTo message your Team Lead, use send_message({ target: "lead", message: "..." }).`}
Use list_agents({}) to find your teammates and their names.
To message another teammate, use send_message({ target: "<teammate name>", message: "..." }).`
      },
    }))
    register(scoped.tools.register(defineTool({
      name: 'spawn_teammate',
      description: 'Create one named, durable teammate. Only the Team Lead may call this tool.',
      parameters: {
        name: {
          type: 'string',
          required: true,
          description: 'Unique lower-kebab-case teammate name.',
        },
        description: {
          type: 'string',
          required: true,
          description: 'Short description of the delegated responsibility.',
        },
        prompt: {
          type: 'string',
          required: true,
          description: 'Complete initial task for the teammate.',
        },
        context: {
          type: 'string',
          enum: ['fresh', 'fork'],
          description: 'fresh starts without Lead history; fork inherits completed Lead turns. Defaults to fresh.',
        },
        provider: {
          type: 'string',
          description: 'LLM provider id for the teammate; requires model. Auto route mode only: fixed-route mode rejects it, and a Session with a route restriction accepts only an allowed route. Discover ids with list_team_models.',
        },
        model: {
          type: 'string',
          description: 'Exact LLM model id for the teammate in auto route mode; requires provider and must belong to an allowed route when the Session restricts routes.',
        },
        reasoning_effort: {
          type: 'string',
          description: 'Reasoning effort id for the teammate in auto route mode. Omit to inherit the Lead effort when the route is unchanged, or to use the model default. With a route restriction, the route it applies to must also be allowed.',
        },
      },
      output: jsonOutput(SPAWN_VALUE_SCHEMA),
      async execute(args, exec) {
        const caller = callingAgent(exec.agent, 'spawn_teammate')
        const context = args.context ?? 'fresh'
        const policy = getPolicy()
        const parentRoute = routeOf(caller)
        const resolved = resolveSpawnModel(policy, parentRoute, args)
        await assertRouteUsable(ctx, resolved.agentOptions, parentRoute, exec.signal)
        const spawned = await withAgentOptions(resolved.agentOptions, () => ctx.agentTeams.spawnTeammate(caller, {
          name: args.name,
          description: args.description,
          prompt: [{ type: 'text', text: args.prompt }],
          context,
          provider: context === 'fork' ? config.forkProvider : config.freshProvider,
          signal: exec.signal,
        }))
        const member = modelMember(ctx, spawned.member)
        return { member: resolved.route === undefined ? member : { ...member, llm: resolved.route } }
      },
    })))
    register(scoped.tools.register(defineTool({
      name: 'send_message',
      description: 'Send one message to another Team member. A running target receives it at the nearest step boundary; an inactive target starts or resumes a turn.',
      parameters: {
        target: {
          type: 'string',
          required: true,
          description: 'Member target returned by spawn_teammate or list_agents, including lead.',
        },
        message: {
          type: 'string',
          required: true,
          description: 'Self-contained message for the target.',
        },
      },
      output: jsonOutput(SEND_VALUE_SCHEMA),
      async execute(args, exec) {
        await ctx.agentTeams.sendMessage(callingAgent(exec.agent, 'send_message'), {
          target: args.target,
          content: [{ type: 'text', text: args.message }],
          signal: exec.signal,
        })
        return { sent: true }
      },
    })))
    register(scoped.tools.register(defineTool({
      name: 'list_agents',
      description: 'List the Lead and every durable teammate with an addressable target and current availability. Each row states the LLM route the member uses. inactive means no turn is executing, not a task result. provisioning and failed describe member creation.',
      parameters: {},
      output: jsonOutput(MEMBER_LIST_VALUE_SCHEMA),
      execute(_args, exec) {
        return Promise.resolve(ctx.agentTeams.listMembers(callingAgent(exec.agent, 'list_agents')).map((member) => modelMember(ctx, member)))
      },
    })))
    register(scoped.tools.register(defineTool({
      name: 'wait_agent',
      description: 'Wait for the next teammate status, message, or shared-task change after this call starts. This never wakes inactive members and returns noProgress immediately when no other member is running or provisioning. Re-list after wakeup or timeout instead of polling.',
      parameters: {
        timeout_ms: {
          type: 'integer',
          description: 'Wait duration in milliseconds, from 10000 through 3600000. Defaults to 30000.',
        },
      },
      output: jsonOutput(WAIT_VALUE_SCHEMA),
      async execute(args, exec) {
        const caller = callingAgent(exec.agent, 'wait_agent')
        const timeoutMs = args.timeout_ms ?? 3e4
        if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1e4 || timeoutMs > 36e5) return await ctx.agentTeams.waitForChange(caller, timeoutMs, exec.signal)
        if (!ctx.agentTeams.listMembers(caller).some((member) => member.id !== caller.id && ACTIVE_WAIT_STATUSES.has(member.status))) {
          return {
            timedOut: false,
            noProgress: { reason: 'no-active-peer', message: NO_ACTIVE_PEER_MESSAGE },
          }
        }
        return await ctx.agentTeams.waitForChange(caller, timeoutMs, exec.signal)
      },
    })))
    if (config.interrupt) register(scoped.tools.register(defineTool({
      name: 'interrupt_agent',
      description: "Interrupt one teammate's current turn while preserving its pending inbox. Team Lead only.",
      parameters: {
        target: {
          type: 'string',
          required: true,
          description: 'Teammate target returned by spawn_teammate or list_agents.',
        },
      },
      output: jsonOutput(INTERRUPT_VALUE_SCHEMA),
      execute(args, exec) {
        return Promise.resolve(ctx.agentTeams.interrupt(callingAgent(exec.agent, 'interrupt_agent'), args.target))
      },
    })))
    register(scoped.tools.register(defineTool({
      name: 'team_task_create',
      description: 'Create one unowned pending task on the shared Team task board.',
      parameters: {
        subject: { type: 'string', required: true, description: 'Concise task title.' },
        description: { type: 'string', required: true, description: 'Complete task details and acceptance criteria.' },
        blocked_by: { type: 'array', items: { type: 'string' }, description: 'Task ids that must complete first.' },
        write_scopes: {
          type: 'array',
          items: { type: 'string' },
          description: 'Advisory workspace-relative file or directory prefixes this task expects to modify.',
        },
      },
      output: jsonOutput(TASK_VIEW_SCHEMA),
      async execute(args, exec) {
        return await ctx.agentTeams.createTask(callingAgent(exec.agent, 'team_task_create'), {
          subject: args.subject,
          description: args.description,
          ...args.blocked_by === undefined ? {} : { blockedBy: args.blocked_by.map(TeamTaskId) },
          ...args.write_scopes === undefined ? {} : { writeScopes: args.write_scopes },
        })
      },
    })))
    register(scoped.tools.register(defineTool({
      name: 'team_task_list',
      description: 'List shared tasks, including readiness, owner, revision, blockers, and write-scope warnings.',
      parameters: {
        status: { type: 'string', enum: ['pending', 'in_progress', 'completed'], description: 'Optional exact status filter.' },
        owner: {
          type: 'string',
          description: 'Optional member target from spawn_teammate or list_agents, matching ownerName; use unowned for tasks without an owner.',
        },
        ready: { type: 'boolean', description: 'Optional readiness filter.' },
        cursor: { type: 'integer', description: 'Zero-based result offset. Defaults to 0.' },
        limit: { type: 'integer', description: 'Number of rows, 1 through 100. Defaults to 50.' },
      },
      output: jsonOutput(TASK_LIST_VALUE_SCHEMA),
      execute(args, exec) {
        const status = args.status
        const filtered = ctx.agentTeams.listTasks(callingAgent(exec.agent, 'team_task_list'))
          .filter((task) => (status === undefined || task.status === status)
            && (args.owner === undefined || (args.owner === 'unowned' ? task.ownerName === undefined : task.ownerName === args.owner))
            && (args.ready === undefined || task.ready === args.ready))
        const cursor = args.cursor ?? 0
        const limit = args.limit ?? 50
        if (!Number.isSafeInteger(cursor) || cursor < 0) throw new Error('cursor must be a non-negative safe integer')
        if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) throw new Error('limit must be an integer from 1 through 100')
        return Promise.resolve({
          tasks: filtered.slice(cursor, cursor + limit),
          ...cursor + limit < filtered.length ? { nextCursor: cursor + limit } : {},
        })
      },
    })))
    register(scoped.tools.register(defineTool({
      name: 'team_task_get',
      description: 'Read the complete latest value of one shared task before changing or executing it.',
      parameters: {
        task_id: { type: 'string', required: true, description: 'Shared task id.' },
      },
      output: jsonOutput(TASK_VIEW_SCHEMA),
      async execute(args, exec) {
        return Promise.resolve(ctx.agentTeams.getTask(callingAgent(exec.agent, 'team_task_get'), TeamTaskId(args.task_id)))
      },
    })))
    register(scoped.tools.register(defineTool({
      name: 'team_task_update',
      description: 'Compare-and-set a shared task action using the latest revision from team_task_get or team_task_list.',
      parameters: {
        task_id: { type: 'string', required: true, description: 'Shared task id.' },
        expected_revision: { type: 'integer', required: true, description: 'Current task revision used as the CAS precondition.' },
        action: {
          type: 'string',
          required: true,
          enum: ['claim', 'release', 'edit', 'set_dependencies', 'complete', 'reopen', 'reassign', 'delete'],
          description: 'Task transition to apply.',
        },
        subject: { type: 'string', description: 'Replacement title for edit.' },
        description: { type: 'string', description: 'Replacement details for edit.' },
        blocked_by: { type: 'array', items: { type: 'string' }, description: 'Complete blocker list for set_dependencies.' },
        write_scopes: { type: 'array', items: { type: 'string' }, description: 'Replacement advisory write scopes for edit.' },
        owner: { type: 'string', description: 'Member target from spawn_teammate or list_agents for Lead-only reassign; omit to unassign.' },
      },
      output: jsonOutput(TASK_VIEW_SCHEMA),
      async execute(args, exec) {
        return await ctx.agentTeams.updateTask(callingAgent(exec.agent, 'team_task_update'), {
          taskId: TeamTaskId(args.task_id),
          expectedRevision: args.expected_revision,
          action: args.action,
          ...args.subject === undefined ? {} : { subject: args.subject },
          ...args.description === undefined ? {} : { description: args.description },
          ...args.blocked_by === undefined ? {} : { blockedBy: args.blocked_by.map(TeamTaskId) },
          ...args.write_scopes === undefined ? {} : { writeScopes: args.write_scopes },
          ...args.owner === undefined ? {} : { owner: args.owner },
        })
      },
    })))
    register(scoped.tools.register(defineTool({
      name: 'list_team_models',
      description: 'Discover LLM routes for teammates without changing the current Agent. Call with no arguments to list providers, with `provider` to list its advertised models, or with `provider` and `model` to inspect that exact model and its reasoning efforts. Use the returned ids with spawn_teammate\'s provider, model, and reasoning_effort fields in auto route mode.',
      parameters: {
        provider: { type: 'string', description: 'Registered LLM provider id. Omit to list providers.' },
        model: { type: 'string', description: 'Exact model id to inspect. Requires provider; omit to list that provider\'s advertised models.' },
      },
      output: {
        schema: { type: 'string' },
        render: (_args, result) => [{ type: 'text', text: result }],
      },
      execute(args, exec) {
        return listTeamModels(ctx, getPolicy(), args, exec.signal)
      },
    })))
  } catch (error) {
    for (const dispose of disposers.reverse()) dispose()
    throw error
  }
  return () => {
    for (const dispose of disposers.reverse()) dispose()
  }
}

/**
 * Mount the Team tools for every live and future Team member.
 *
 * @param ctx - plugin context.
 * @param config - validated loader config.
 */
export function apply(ctx, config = {}) {
  const getPolicy = () => assertModelSelectionPolicy(readModelSelectionConfig(config))
  const resolved = {
    interrupt: config.interrupt ?? true,
    freshProvider: config.freshProvider ?? 'spawn',
    forkProvider: config.forkProvider ?? 'fork',
  }
  ctx.effect(() => installActivationRouteHook(ctx), 'team-model-selection.activationRoute()')
  const installed = new Map()
  const maybeInstall = (agent) => {
    if (installed.has(agent) || ctx.agentTeams.tryMembership(agent) === undefined) return
    installed.set(agent, install(agent, ctx, resolved, getPolicy))
  }
  for (const agent of ctx.agents.list()) maybeInstall(agent)
  ctx.on('agent/created', ({ agent }) => {
    maybeInstall(agent)
  })
  ctx.on('agent/disposed', ({ agent }) => {
    installed.get(agent)?.()
    installed.delete(agent)
  })
  ctx.effect(() => () => {
    for (const dispose of installed.values()) dispose()
    installed.clear()
  }, 'team-model-selection.scopedTools()')
}
