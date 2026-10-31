# Contributing

## Requirements

- Node.js 22 or 24 (the plugin has no npm dependencies and no build step)
- A DeepSeek Harness (DSH) profile with the experimental Agent Teams bundle
  (`@deepseek-ai/dsh-experimental-agent-team-profile`) enabled

## Run the tests

```bash
node --test test/model-selection.test.js test/tool.test.js
```

or:

```bash
npm test
```

## Install a checkout into a profile

From a DSH session, install the checkout's absolute directory:

```js
plugin_manager({ action: "install_bundle", target: "/absolute/path/to/dsh-agent-team-model-selection" })
```

The bundle patch disables the shipped `tool-agent-team` row because both plugins
register the same nine Team tool names; this plugin's row
`tool-agent-team-model-selection` provides them instead. Use
`plugin_manager({ action: "remove_bundle", target: "dsh-agent-team-model-selection" })`
to restore the shipped row.

## Layout

| Path | Purpose |
|---|---|
| `index.js` | Host half: Team tool registrations, route policy, activation seam |
| `client.js` | Browser half: the settings page (`settings.section`) |
| `lib/model-selection.js` | Pure policy and catalog formatting rules |
| `lib/tool.js` | Dependency-free tool definition/validation helper |
| `lib/vendor/` | Vendored `schemastery` and `cosmokit` (MIT, see `THIRD_PARTY_NOTICES.md`) |
| `cordis.patch.yml` | Bundle patch: replaces the shipped Team tool row |
| `test/` | `node:test` unit tests |

## Design constraints

- No npm dependencies: profile-installed bundles are linked from their checkout,
  so bare package imports do not resolve to the running installation. Keep the
  host/client halves self-contained and relative-import only.
- Host configuration fields that the settings page edits must be declared
  `.volatile()` so a save can update the running plugin without a reload.
- The settings page must not import Harness Client packages. Use the `slots`,
  `locale`, `configForms`, `remote`, and `remote.session` services and the
  `--dsw-alias-*` theme tokens.
- Route injection happens at `ctx.subagents.startActivation`; changes there must
  stay reload-safe (the pending store is shared through `globalThis`).

## Publishing

Bump `version` in `package.json`, add a `CHANGELOG.md` entry, and commit. The
GitHub Actions workflow runs the unit tests on Node 22 and 24.
