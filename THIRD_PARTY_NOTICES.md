# Third-party notices

This package vendors two small runtime libraries so the plugin can declare a
`Config` schema and expose volatile settings without depending on npm packages
at install time. Both are MIT-licensed and are redistributed unchanged except
for the import path noted below.

## @deepseek-ai/schemastery 3.18.5

- File: [`lib/vendor/schemastery.js`](lib/vendor/schemastery.js)
- License: MIT, Copyright (c) 2021-present Shigma
- License copy: [`lib/vendor/LICENSE.schemastery`](lib/vendor/LICENSE.schemastery)
- Modification: the `@deepseek-ai/cosmokit` import specifier is rewritten to the
  relative `./cosmokit.js` so the vendored pair resolves inside this package.

## @deepseek-ai/cosmokit 1.8.6

- File: [`lib/vendor/cosmokit.js`](lib/vendor/cosmokit.js)
- License: MIT, Copyright (c) 2021-present Shigma
- License copy: [`lib/vendor/LICENSE.cosmokit`](lib/vendor/LICENSE.cosmokit)
- No code changes.

The volatile-config reference protocol in `cosmokit` is keyed on
`Symbol.for("cosmokit.volatile.write")`, so the vendored copies interoperate
with the Host installation's copies of the same libraries.
