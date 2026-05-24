// Stub for `pg-cloudflare` — that package is only used by `pg/lib/stream.js`
// when running inside a Cloudflare Worker (it dynamic-imports `cloudflare:sockets`).
// In a Node deploy the import is never executed, but Turbopack still tries to
// bundle the file and can't resolve the Cloudflare-only specifier, which makes
// every /api request crash with "Cannot find package 'pg-<hash>'". Aliasing to
// this no-op shim removes the unbundleable graph and pg uses its native `net`
// path as before.
module.exports = { CloudflareSocket: class {} };
