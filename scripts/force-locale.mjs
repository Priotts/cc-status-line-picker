/**
 * Preloaded into each style process via `node --import` so previews render
 * identically on every machine.
 *
 * The styles format reset times with `toLocaleTimeString(undefined, …)`, which
 * resolves to the host's locale. That would make the generated gallery differ
 * between a Windows laptop and a Linux CI runner — Italian weekday names in one,
 * English in the other — for no reason the reader could see.
 *
 * en-GB is chosen for 24-hour times and English weekday names, matching the
 * rest of the site.
 *
 * Only the default is replaced: an explicit locale argument still wins.
 */
const LOCALE = 'en-GB';

for (const method of ['toLocaleTimeString', 'toLocaleDateString', 'toLocaleString']) {
  const original = Date.prototype[method];
  Date.prototype[method] = function (locales, options) {
    return original.call(this, locales ?? LOCALE, options);
  };
}
