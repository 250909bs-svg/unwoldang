# Report access gate

`/report/:id` treats browser-side checks as defense in depth, not as proof of payment.
The payment/report API remains authoritative and must validate the authenticated user,
order, product, and report-access token before generating a report or accepting a remote
archive write.

The client gate follows these rules:

- Hardcoded preview data is available only when Vite is in development mode **and** the
  page hostname is `localhost`, `127.0.0.1`, or `[::1]`.
- Every other host, including preview deployments such as `*.vercel.app`, requires both
  a structurally valid report matching the route product and a valid `UW-...` order ID.
- A freshly generated report may also carry a report-access token. An archive replay is
  intentionally allowed without that bearer token because tokens are not persisted.
- Preview, missing-order, and missing/invalid-report states are never written to the
  local or remote report archive.

These checks reduce accidental exposure through direct navigation. They cannot stop a
user from modifying JavaScript state in their own browser, so paid-content enforcement
must remain on the server boundary.
