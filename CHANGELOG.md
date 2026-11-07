# Changelog

All notable changes to this plugin are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/).

## [0.7.0] - 2026-11-07

### Changed

- The automatic-mode whitelist now bounds the teammate's **effective** route,
  not just explicit `provider`/`model` arguments. An effort-only override or a
  no-argument spawn that would inherit a Lead route outside the whitelist is
  refused with an error that lists the allowed routes. A restricted session can
  therefore never create a member on an unlisted route.
- The Team system prompt and `spawn_teammate` parameter descriptions are now
  rendered from the live policy: restricted and fixed deployments no longer
  claim the Lead may pass arbitrary routes.
- The settings page shows the "select at least one route" warning directly under
  the restriction toggle instead of only in the footer, and the whitelist help
  text now states that inheritance is constrained too.

### Fixed

- **A teammate could still be spawned on a route outside the whitelist.** With
  the restriction enabled but no `provider`/`model` arguments, `spawn_teammate`
  fell through to inheritance and the new member ran on the Lead route, which
  the whitelist deliberately exempted. Inheritance and effort-only overrides
  are now checked against the whitelist.

## [0.6.0] - 2026-10-31

### Changed

- Route policy is now two explicit modes, each with its own settings menu:
  - **Automatic** (`modelSelection.mode: "inherit"`): without route arguments a
    teammate follows the Lead, including later Lead model switches; `provider`,
    `model`, and `reasoning_effort` may still pin one member. The optional
    whitelist constrains exactly those explicit route choices.
  - **Fixed route** (`modelSelection.mode: "fixed"`): every teammate uses the
    configured route and `spawn_teammate` rejects every route parameter.
- The settings page shows the fixed-route fields only in fixed mode and the
  whitelist only in automatic mode.
- The whitelist no longer gates the fixed route; it is an administrator-owned
  route and only has to exist in the LLM directory.
- `reasoning_effort`-only overrides are no longer checked against the whitelist:
  they change the effort on the inherited route, not the route itself.

### Removed

- `modelSelection.allowModelOverride` is no longer used by the route policy or
  shown in settings. Legacy configuration values are ignored.

### Fixed

- Route injection no longer goes silently stale after a plugin reload. A stale
  `startActivation` hook from an earlier module generation used to make the new
  instance skip installation, so spawned members fell back to the Lead route.
  The pending-route store now lives on a stable `globalThis` symbol, and a
  reinstall replaces stale hooks instead of trusting their marker.

## [0.5.0] - 2026-10-31

### Added

- Settings page at **Settings → Agent Teams models** (`settings.section` id
  `agent-team-models`) for mode, fixed route, whitelist, and reset-to-default.
- Volatile `Config` schema so settings writes take effect without reloading the
  plugin, backed by vendored `schemastery`/`cosmokit`.

## [0.4.0] - 2026-10-31

### Added

- Client half (`dsh.client`) and the bannered settings page registration.
- Plugin metadata describing the intentional replacement of the shipped
  `tool-agent-team` row.

## [0.2.0] - 2026-10-31

### Added

- `list_agents` reports the live `llm` route of every member.
- Settings namespace wiring through the plugin row `Config`.

## [0.1.1] - 2026-10-31

### Added

- `spawn_teammate` accepts `provider`, `model`, and `reasoning_effort`.
- `list_team_models` discovery tool.
- Configuration for follow-parent versus fixed-route mode and an allowlist.

## [0.1.0] - 2026-10-31

### Added

- Initial plugin bundle that replaces `tool-agent-team` so teammates can run on
  their own route.
