window.__ModuleLoader__.load({
  id: 'dsh-agent-team-model-selection',
  factory(require) {
    const React = require('react')
    const h = React.createElement

    /** Locale namespace owned by this plugin. */
    const NS = 'agent-team-model-settings'
    /** Host settings namespace: the plugin row id this page edits. */
    const SETTINGS_NAMESPACE = 'tool-agent-team-model-selection'

    const en = {
      title: 'Agent Teams models',
      summary: 'Automatic follows the Lead and may take a per-spawn route; fixed pins every teammate and rejects route parameters.',
      modeTitle: 'Route mode',
      modeAuto: 'Automatic',
      modeFixed: 'Fixed route',
      modeAutoHelp: 'With no route arguments a new teammate follows the Lead, including later Lead model switches. provider, model, and reasoning_effort may still pin one member.',
      modeFixedHelp: 'Every new teammate uses the fixed route below; spawn_teammate rejects provider, model, and reasoning_effort.',
      fixedTitle: 'Fixed teammate route',
      provider: 'Provider',
      model: 'Model',
      effort: 'Reasoning effort',
      effortDefault: 'Model default',
      none: 'Not set',
      unavailableOption: 'Currently unavailable',
      allowListTitle: 'Routes teammates may use',
      allowListHelp: 'The whitelist bounds every teammate route: an explicit provider/model, an effort-only override, and inheritance from the Lead must all resolve into this list.',
      restrictToggle: 'Restrict the routes teammates may use',
      restrictHelp: 'When enabled, a teammate may run only on a route in this list; inheriting an unlisted Lead route fails.',
      allowListEmpty: 'Select at least one route, or turn the restriction off.',
      allowListUnavailable: 'Saved but currently unavailable',
      noModels: 'No provider currently advertises a model.',
      save: 'Save',
      saving: 'Saving…',
      saved: 'Saved.',
      discard: 'Discard changes',
      reset: 'Restore defaults',
      readOnly: 'This deployment stores settings read-only.',
      unavailable: 'This settings page is unavailable because the Agent Teams model plugin is not active.',
      loading: 'Loading settings…',
      catalogLoading: 'Loading models…',
      loadFailed: 'Settings could not be loaded.',
      catalogFailed: 'Models could not be loaded; saved values remain editable.',
      catalogPartial: 'Some providers could not be listed.',
      saveFailed: 'The Host rejected the change; your draft was kept.',
      conflict: 'Settings changed elsewhere. Discard your draft and try again.',
      dirty: 'Unsaved changes.',
      fixedIncomplete: 'Choose a provider and model for the fixed route.',
      noChanges: 'No changes to save.',
    }

    const zh = {
      title: 'Agent Teams 模型',
      summary: '自动模式默认跟随父 Agent，也可按成员指定路由；固定模式统一使用配置路由且不接受路由参数。',
      modeTitle: '路由模式',
      modeAuto: '自动',
      modeFixed: '固定路由',
      modeAutoHelp: '不传路由参数时新成员沿用父 Agent（之后 Lead 切换模型也继续跟随）；仍可传 provider、model、reasoning_effort 为单个成员指定路由。',
      modeFixedHelp: '所有新成员固定使用下方路由；spawn_teammate 不接受 provider、model、reasoning_effort。',
      fixedTitle: '成员固定路由',
      provider: '提供方',
      model: '模型',
      effort: '思考等级',
      effortDefault: '模型默认',
      none: '未设置',
      unavailableOption: '当前不可用',
      allowListTitle: '成员可用的路由',
      allowListHelp: '白名单约束成员的实际路由：显式传入的 provider/model、只改思考等级、以及不传参数继承父 Agent 路由，最终路由都必须在白名单内。',
      restrictToggle: '限制成员可用的路由',
      restrictHelp: '开启后，成员只能运行在白名单内的路由；继承到白名单外的父路由会直接报错。',
      allowListEmpty: '请至少选择一个路由，或关闭限制。',
      allowListUnavailable: '已保存但当前不可用',
      noModels: '当前没有提供方公布模型。',
      save: '保存',
      saving: '保存中…',
      saved: '已保存。',
      discard: '放弃修改',
      reset: '恢复默认',
      readOnly: '本部署的设置只读。',
      unavailable: 'Agent Teams 模型插件未启用，因此该设置页不可用。',
      loading: '正在加载设置…',
      catalogLoading: '正在加载模型…',
      loadFailed: '设置加载失败。',
      catalogFailed: '模型列表加载失败；已保存的值仍可编辑。',
      catalogPartial: '部分提供方未能列出。',
      saveFailed: 'Host 拒绝了修改，草稿已保留。',
      conflict: '设置已在其他位置更新，请放弃草稿后重试。',
      dirty: '有未保存的修改。',
      fixedIncomplete: '请为固定路由选择提供方和模型。',
      noChanges: '没有需要保存的修改。',
    }

    const CSS = [
      '.tm-root{display:flex;flex-direction:column;gap:20px;padding:4px 0 24px;max-width:760px;color:var(--dsw-alias-label-primary);font-size:13px;line-height:1.6}',
      '.tm-section{display:flex;flex-direction:column;gap:10px}',
      '.tm-heading{font-size:13px;font-weight:600;margin:0;color:var(--dsw-alias-label-primary)}',
      '.tm-help{color:var(--dsw-alias-label-secondary);font-size:12px;margin:0}',
      '.tm-field{display:grid;grid-template-columns:160px minmax(0,1fr);gap:12px;align-items:center;min-width:0}',
      '.tm-label{color:var(--dsw-alias-label-secondary);font-size:12px}',
      '.tm-select{appearance:none;background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l2);border-radius:6px;color:var(--dsw-alias-label-primary);font:inherit;padding:5px 8px;min-width:0;height:30px}',
      '.tm-select:disabled{opacity:.55}',
      '.tm-radio-row{display:flex;gap:18px;flex-wrap:wrap}',
      '.tm-radio{display:flex;gap:6px;align-items:center;font-size:13px;cursor:pointer}',
      '.tm-radio input{margin:0}',
      '.tm-toggle{display:flex;gap:8px;align-items:flex-start;cursor:pointer}',
      '.tm-toggle input{margin:3px 0 0}',
      '.tm-toggle-text{display:flex;flex-direction:column;gap:2px;min-width:0}',
      '.tm-toggle-title{font-size:13px}',
      '.tm-list{max-height:260px;overflow:auto;border:1px solid var(--dsw-alias-border-l1);border-radius:6px;padding:8px 10px;display:flex;flex-direction:column;gap:8px;background:var(--dsw-alias-bg-base)}',
      '.tm-group{display:flex;flex-direction:column;gap:4px}',
      '.tm-group-title{color:var(--dsw-alias-label-secondary);font-size:12px;font-weight:600}',
      '.tm-checkbox{display:flex;gap:6px;align-items:center;font-size:12px;cursor:pointer}',
      '.tm-checkbox input{margin:0}',
      '.tm-unavailable{color:var(--dsw-alias-state-warn-primary)}',
      '.tm-footer{display:flex;gap:8px;align-items:center;flex-wrap:wrap;border-top:1px solid var(--dsw-alias-border-l1);padding-top:12px}',
      '.tm-button{font:inherit;padding:5px 12px;border-radius:6px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);cursor:pointer;height:28px}',
      '.tm-button[data-primary="true"]{background:var(--dsw-alias-brand-primary);border-color:var(--dsw-alias-brand-primary);color:var(--dsw-alias-bg-base)}',
      '.tm-button:disabled{opacity:.5;cursor:default}',
      '.tm-status{font-size:12px;color:var(--dsw-alias-label-secondary);margin-left:4px}',
      '.tm-error{font-size:12px;color:var(--dsw-alias-state-error-primary)}',
      '.tm-warn{font-size:12px;color:var(--dsw-alias-state-warn-primary)}',
    ].join('\n')

    /** Read the projected form value into the page's draft shape. */
    function readValue(value) {
      const section = value?.modelSelection ?? {}
      return {
        mode: section.mode === 'fixed' ? 'fixed' : 'inherit',
        provider: typeof section.provider === 'string' ? section.provider : '',
        model: typeof section.model === 'string' ? section.model : '',
        reasoningEffort: typeof section.reasoningEffort === 'string' ? section.reasoningEffort : '',
        allowedModels: Array.isArray(section.allowedModels)
          ? section.allowedModels.map((route) => ({ provider: route.provider, model: route.model }))
          : [],
      }
    }

    /** Stable identity for one provider/model pair. */
    function routeKey(route) {
      return `${route.provider}\u0000${route.model}`
    }

    /** Whether two route lists contain the same exact routes. */
    function sameRoutes(left, right) {
      if (left.length !== right.length) return false
      const keys = new Set(right.map(routeKey))
      return left.every((route) => keys.has(routeKey(route)))
    }

    /** Whether a draft differs from the stored value. */
    function isDirty(draft, current) {
      return draft.mode !== current.mode
        || draft.provider !== current.provider
        || draft.model !== current.model
        || draft.reasoningEffort !== current.reasoningEffort
        || !sameRoutes(draft.allowedModels, current.allowedModels)
    }

    /** Build the ordered volatile field edits for one save. */
    function buildOps(draft, current) {
      const ops = []
      for (const field of ['mode', 'provider', 'model', 'reasoningEffort']) {
        if (draft[field] !== current[field]) ops.push({ op: 'set', path: ['modelSelection', field], value: draft[field] })
      }
      if (!sameRoutes(draft.allowedModels, current.allowedModels)) {
        ops.push({ op: 'set', path: ['modelSelection', 'allowedModels'], value: draft.allowedModels.map((route) => ({ provider: route.provider, model: route.model })) })
      }
      return ops
    }

    /** Flatten catalog groups into selectable route rows. */
    function catalogRoutes(groups) {
      const rows = []
      for (const group of groups ?? []) {
        for (const model of group.models ?? []) rows.push({ provider: group.id, model: model.id })
      }
      return rows
    }

    /** One native select bound to a draft field. */
    function SelectField(props) {
      return h('div', { className: 'tm-field' }, [
        h('label', { key: 'label', className: 'tm-label' }, props.label),
        h('select', {
          key: 'control',
          className: 'tm-select',
          value: props.value,
          disabled: props.disabled,
          'aria-label': props.label,
          onChange: (event) => props.onChange(event.target.value),
        }, props.options.map((option) => h('option', { key: option.value, value: option.value }, option.label))),
      ])
    }

    /** The Agent Teams model settings page. */
    function TeamModelPage(props) {
      const t = props.translate ?? props.t
      const snapshot = props.useTeamModelForm((state) => state)
      const [draft, setDraft] = React.useState(undefined)
      const [catalog, setCatalog] = React.useState({ status: 'loading', groups: [], failures: [] })
      const [saving, setSaving] = React.useState(false)
      const [failed, setFailed] = React.useState(false)
      const [conflict, setConflict] = React.useState(false)
      const [justSaved, setJustSaved] = React.useState(false)
      const [restrictOverride, setRestrictOverride] = React.useState(undefined)

      const status = snapshot.status
      const ready = status === 'ready'
      const writable = snapshot.writable === true
      const current = ready ? readValue(snapshot.value) : undefined
      const revision = snapshot.revision

      React.useEffect(() => {
        if (current === undefined) return
        setDraft((previous) => previous === undefined || !isDirty(previous, current) ? current : previous)
        setRestrictOverride(undefined)
      }, [revision, status])

      React.useEffect(() => {
        let cancelled = false
        props.loadCatalog().then((result) => {
          if (!cancelled) setCatalog(result)
        })
        return () => {
          cancelled = true
        }
      }, [])

      if (props.view === 'summary') return t('summary')
      if (!ready || draft === undefined) {
        return h('div', { className: 'tm-root' }, [
          h('style', { key: 'style' }, CSS),
          h('p', { key: 'status', className: 'tm-help' }, status === 'unavailable' ? t('unavailable') : status === 'loading' ? t('loading') : t('loadFailed')),
        ])
      }

      const locked = !writable || saving
      const update = (patch) => {
        setJustSaved(false)
        setDraft((previous) => ({ ...previous, ...patch }))
      }

      const groups = catalog.groups ?? []
      const providerOptions = [{ value: '', label: t('none') }, ...groups.map((group) => ({ value: group.id, label: group.name ?? group.id }))]
      if (draft.provider !== '' && !groups.some((group) => group.id === draft.provider)) {
        providerOptions.push({ value: draft.provider, label: `${draft.provider} (${t('unavailableOption')})` })
      }
      const activeGroup = groups.find((group) => group.id === draft.provider)
      const modelOptions = [{ value: '', label: t('none') }, ...(activeGroup?.models ?? []).map((model) => ({ value: model.id, label: model.name ?? model.id }))]
      if (draft.model !== '' && !(activeGroup?.models ?? []).some((model) => model.id === draft.model)) {
        modelOptions.push({ value: draft.model, label: `${draft.model} (${t('unavailableOption')})` })
      }
      const activeModel = (activeGroup?.models ?? []).find((model) => model.id === draft.model)
      const effortOptions = [{ value: '', label: t('effortDefault') }, ...(activeModel?.reasoning?.efforts ?? []).map((effort) => ({ value: effort.id, label: effort.name ?? effort.id }))]
      if (draft.reasoningEffort !== '' && !(activeModel?.reasoning?.efforts ?? []).some((effort) => effort.id === draft.reasoningEffort)) {
        effortOptions.push({ value: draft.reasoningEffort, label: draft.reasoningEffort })
      }

      const restrict = restrictOverride ?? draft.allowedModels.length > 0
      const selectedKeys = new Set(draft.allowedModels.map(routeKey))
      const knownRoutes = new Set(catalogRoutes(groups).map(routeKey))
      const unavailableRoutes = draft.allowedModels.filter((route) => !knownRoutes.has(routeKey(route)))
      const toggleRoute = (route) => {
        const key = routeKey(route)
        const next = selectedKeys.has(key)
          ? draft.allowedModels.filter((candidate) => routeKey(candidate) !== key)
          : [...draft.allowedModels, { provider: route.provider, model: route.model }]
        update({ allowedModels: next })
      }

      let invalid
      if (draft.mode === 'fixed' && (draft.provider === '' || draft.model === '')) invalid = t('fixedIncomplete')
      else if (draft.mode !== 'fixed' && restrict && draft.allowedModels.length === 0) invalid = t('allowListEmpty')

      const dirty = isDirty(draft, current)
      const canSave = writable && dirty && invalid === undefined && !saving

      const save = async () => {
        if (!canSave) return
        setSaving(true)
        setFailed(false)
        setConflict(false)
        setJustSaved(false)
        const result = await props.save(buildOps(draft, current), revision)
        setSaving(false)
        if (result.ok) setJustSaved(true)
        else if (result.conflict) setConflict(true)
        else setFailed(true)
      }
      const discard = () => {
        setDraft(current)
        setRestrictOverride(undefined)
        setFailed(false)
        setConflict(false)
        setJustSaved(false)
      }
      const reset = async () => {
        if (!writable || saving) return
        setSaving(true)
        setFailed(false)
        setConflict(false)
        const result = await props.reset(revision)
        setSaving(false)
        setRestrictOverride(undefined)
        if (result.ok) setJustSaved(true)
        else if (result.conflict) setConflict(true)
        else setFailed(true)
      }

      const statusText = conflict ? h('span', { className: 'tm-error' }, t('conflict'))
        : failed ? h('span', { className: 'tm-error' }, t('saveFailed'))
          : invalid !== undefined ? h('span', { className: 'tm-warn' }, invalid)
            : saving ? h('span', { className: 'tm-status' }, t('saving'))
              : justSaved ? h('span', { className: 'tm-status' }, t('saved'))
                : dirty ? h('span', { className: 'tm-status' }, t('dirty')) : null

      const modeSection = h('section', { key: 'mode', className: 'tm-section' }, [
        h('h3', { key: 'h', className: 'tm-heading' }, t('modeTitle')),
        !writable ? h('p', { key: 'ro', className: 'tm-help' }, t('readOnly')) : null,
        h('div', { key: 'rows', className: 'tm-radio-row' }, ['inherit', 'fixed'].map((mode) => h('label', { key: mode, className: 'tm-radio' }, [
          h('input', {
            key: 'input',
            type: 'radio',
            name: 'team-model-mode',
            checked: draft.mode === mode,
            disabled: locked,
            onChange: () => update({ mode }),
          }),
          h('span', { key: 'label' }, mode === 'inherit' ? t('modeAuto') : t('modeFixed')),
        ]))),
        h('p', { key: 'help', className: 'tm-help' }, draft.mode === 'fixed' ? t('modeFixedHelp') : t('modeAutoHelp')),
      ])

      const fixedSection = draft.mode !== 'fixed' ? null : h('section', { key: 'fixed', className: 'tm-section' }, [
        h('h3', { key: 'h', className: 'tm-heading' }, t('fixedTitle')),
        h(SelectField, {
          key: 'provider',
          label: t('provider'),
          value: draft.provider,
          options: providerOptions,
          disabled: locked,
          onChange: (provider) => update({ provider, model: '', reasoningEffort: '' }),
        }),
        h(SelectField, {
          key: 'model',
          label: t('model'),
          value: draft.model,
          options: modelOptions,
          disabled: locked || draft.provider === '',
          onChange: (model) => update({ model, reasoningEffort: '' }),
        }),
        h(SelectField, {
          key: 'effort',
          label: t('effort'),
          value: draft.reasoningEffort,
          options: effortOptions,
          disabled: locked,
          onChange: (reasoningEffort) => update({ reasoningEffort }),
        }),
        catalog.status === 'loading' ? h('p', { key: 'cl', className: 'tm-help' }, t('catalogLoading')) : null,
        catalog.status === 'error' ? h('p', { key: 'ce', className: 'tm-warn' }, t('catalogFailed')) : null,
      ])

      const allowListSection = h('section', { key: 'allowlist', className: 'tm-section' }, [
        h('h3', { key: 'h', className: 'tm-heading' }, t('allowListTitle')),
        h('label', { key: 'toggle', className: 'tm-toggle' }, [
          h('input', {
            key: 'input',
            type: 'checkbox',
            checked: restrict,
            disabled: locked,
            onChange: (event) => {
              const next = event.target.checked
              setRestrictOverride(next)
              update({
                allowedModels: next ? draft.allowedModels : [],
              })
            },
          }),
          h('span', { key: 'text', className: 'tm-toggle-text' }, [
            h('span', { key: 'title', className: 'tm-toggle-title' }, t('restrictToggle')),
            h('span', { key: 'help', className: 'tm-help' }, t('restrictHelp')),
          ]),
        ]),
        restrict ? h('p', { key: 'help', className: 'tm-help' }, t('allowListHelp')) : null,
        restrict && invalid !== undefined ? h('p', { key: 'invalid', className: 'tm-warn' }, invalid) : null,
        restrict ? h('div', { key: 'list', className: 'tm-list' }, [
          catalog.status === 'loading' ? h('p', { key: 'cl', className: 'tm-help' }, t('catalogLoading')) : null,
          catalog.status === 'error' ? h('p', { key: 'ce', className: 'tm-warn' }, t('catalogFailed')) : null,
          catalog.status === 'ready' && groups.length === 0 ? h('p', { key: 'none', className: 'tm-help' }, t('noModels')) : null,
          ...groups.map((group) => h('div', { key: group.id, className: 'tm-group' }, [
            h('span', { key: 'name', className: 'tm-group-title' }, group.name ?? group.id),
            ...(group.models ?? []).map((model) => {
              const route = { provider: group.id, model: model.id }
              return h('label', { key: model.id, className: 'tm-checkbox' }, [
                h('input', {
                  key: 'input',
                  type: 'checkbox',
                  checked: selectedKeys.has(routeKey(route)),
                  disabled: locked,
                  onChange: () => toggleRoute(route),
                }),
                h('span', { key: 'name' }, model.name ?? model.id),
              ])
            }),
          ])),
          unavailableRoutes.length === 0 ? null : h('div', { key: 'stale', className: 'tm-group' }, [
            h('span', { key: 'name', className: 'tm-group-title tm-unavailable' }, t('allowListUnavailable')),
            ...unavailableRoutes.map((route) => h('label', { key: routeKey(route), className: 'tm-checkbox tm-unavailable' }, [
              h('input', {
                key: 'input',
                type: 'checkbox',
                checked: true,
                disabled: locked,
                onChange: () => toggleRoute(route),
              }),
              h('span', { key: 'name' }, `${route.provider} / ${route.model}`),
            ])),
          ]),
        ]) : null,
        catalog.status === 'ready' && catalog.failures.length > 0 ? h('p', { key: 'partial', className: 'tm-help' }, t('catalogPartial')) : null,
      ])

      const footer = h('div', { key: 'footer', className: 'tm-footer' }, [
        h('button', {
          key: 'save',
          type: 'button',
          className: 'tm-button',
          'data-primary': 'true',
          disabled: !canSave,
          onClick: save,
        }, saving ? t('saving') : t('save')),
        h('button', {
          key: 'discard',
          type: 'button',
          className: 'tm-button',
          disabled: !dirty || saving || !writable,
          onClick: discard,
        }, t('discard')),
        h('button', {
          key: 'reset',
          type: 'button',
          className: 'tm-button',
          disabled: locked,
          onClick: reset,
        }, t('reset')),
        statusText,
      ])

      return h('div', { className: 'tm-root' }, [
        h('style', { key: 'style' }, CSS),
        modeSection,
        fixedSection,
        draft.mode === 'fixed' ? null : allowListSection,
        footer,
      ])
    }

    /** Mount the settings page while the Host serves this plugin's namespace. */
    function apply(ctx) {
      const t = ctx.locale.bind(NS)
      ctx.effect(() => ctx.locale.register(NS, { en, zh }), 'ui-agent-team-models:dictionaries')
      const form = ctx.configForms.get(SETTINGS_NAMESPACE)
      const loadCatalog = async () => {
        try {
          const response = await ctx.remote.session.modelCatalog()
          if (response?.ok !== true) return { status: 'error', groups: [], failures: [] }
          return {
            status: 'ready',
            groups: response.value?.groups ?? [],
            failures: response.value?.failures ?? [],
          }
        } catch {
          return { status: 'error', groups: [], failures: [] }
        }
      }
      const save = async (ops, revision) => {
        try {
          return { ok: await form.mutate(ops, revision) }
        } catch {
          return { ok: false, conflict: true }
        }
      }
      const reset = async (revision) => {
        const ops = ['mode', 'provider', 'model', 'reasoningEffort', 'allowedModels'].map((field) => ({
          op: 'unset',
          path: ['modelSelection', field],
        }))
        try {
          return { ok: await form.mutate(ops, revision) }
        } catch {
          return { ok: false, conflict: true }
        }
      }
      const face = {
        hooks: { teamModelForm: form },
        translate: t,
        loadCatalog,
        save,
        reset,
      }
      ctx.effect(() => ctx.configForms.whileServed([SETTINGS_NAMESPACE], () => ctx.slots.inject('settings.section', () => ctx.slots.register({
        name: 'settings.section',
        id: 'agent-team-models',
        order: 25,
        label: () => t('title'),
        locale: NS,
        inject: () => face,
      }, TeamModelPage))), 'ui-agent-team-models:page')
    }

    return {
      inject: ['slots', 'locale', 'configForms', 'remote', 'remote.session'],
      apply,
    }
  },
})
