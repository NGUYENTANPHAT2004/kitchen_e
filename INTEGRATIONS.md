# Integration Credentials Handoff

These templates list variables verified against the current source code:

- `be/integrations.env.example`: payments, SMTP, OAuth, S3 and Python service URLs.
- `py-ai/integrations.env.example`: model paths and Python service configuration.

## Existing Configuration

The owner already supplied the credentials in the local `.env` files. No values
were changed or copied into the example files. Checks on September 7, 2026:

- VNPay: merchant variables present; payment endpoint is sandbox. No transaction sent.
- SMTP: live connection and authentication passed; no email delivered.
- S3: `HeadBucket` returned 403, but `GetBucketLocation` passed with the same
  credentials. Review bucket permissions; this does not prove invalid credentials.
  Object upload/read/delete have not been tested.
- Google/Facebook: credentials present; full provider login has not been tested.
- AI: both API-key variables exist, but the configured Python health endpoint is
  unavailable. A hosted AI client is still not implemented.

## Integration Requirements

| Integration     | Owner-supplied configuration                                                                    | Remaining engineering work                                                                                                                     |
| --------------- | ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| VNPay           | Sandbox merchant code, signing secret, matching payment URL and merchant test instructions      | Finish/verify browser return, provider notification acknowledgement and frontend payment flow before enabling                                  |
| Refunds         | Provider documentation and confirmation that the merchant account has refund access             | Implement provider refund requests, authorization, amount validation, idempotency, reconciliation and sandbox tests; keys alone are not enough |
| SMTP            | Host, port, encryption setting, username/password and permitted sender address                  | Controlled delivery test; verify registration/reset links and failure handling                                                                 |
| Google/Facebook | Client/app ID, secret, chosen test domain and approved test accounts                            | Register exact callbacks for that domain and test login/account linking                                                                        |
| AWS S3          | Region, test bucket and credentials scoped to that bucket                                       | Verify upload/read/delete and image delivery without granting public write access                                                              |
| AI              | Choice of local models or a hosted provider; model files/compute for the current implementation | Start/test Python service; implement a provider client if hosted AI is chosen                                                                  |

## Secret Handling

1. Do not send secrets through chat, commit them, put them into these example files,
   or put them into frontend `VITE_*` environment variables.
2. Add values to the existing `be/.env` or `py-ai/.env` on the local machine.
   Preserve unrelated settings and existing database configuration.
3. Report only the provider names and that the relevant file is ready. Do not
   include credential values. Supply the intended test frontend/API domains too.
4. Keep sandbox and production credentials separate. Initial tests must use
   synthetic data and a dedicated test bucket/mail recipient.

## Current Runtime Behavior

`start-local.ps1` uses `be/scripts/start-local.js`, which deliberately overrides
email to local files, storage to local disk, OAuth credentials to empty strings,
VNPay to disabled and AI URLs to the loopback Python service. Filling `.env` does
not enable these external integrations in the running demo.

Selective integration mode now reads the existing credentials while keeping
MongoDB, JWT/session secrets and Redis isolated from external configuration:

```powershell
npm --prefix be run check:integrations
npm --prefix be run check:integrations -- --network
# Stop the existing server before selecting a different mode.
.\stop-local.ps1
.\start-local.ps1 -Integrations 'google,facebook'
```

Available selectors: `google`, `facebook`, `smtp`, `s3`, `vnpay`, `ai`. Only select
the service being tested. SMTP mode enables real delivery on normal mail routes;
S3 mode enables real object writes on upload routes. Neither is selected above.
VNPay mode rejects non-sandbox URLs and does not finish the remaining payment UI,
provider callback or refund work. AI mode selects a configured URL, not a model
provider or a running Python process. The current demo remains in isolated mode.

`--network` authenticates SMTP without sending mail, checks S3 bucket metadata
without object writes, and requests AI health. It never prints credential values.
OAuth mode preserves `API_URL` and `FRONTEND_URL` from `.env` so callback origins
are not silently changed. Those must match the provider's registered callbacks
and the running app. Startup rejects silently reusing a different integration mode.

Current OAuth callback paths are `/api/auth/google/callback` and
`/api/auth/facebook/callback`, both on `API_URL`. Frontend OAuth completion is
`/auth/oauth-callback` on `FRONTEND_URL`.

The active mail utility uses `SMTP_USER`, `FROM_NAME` and `FROM_EMAIL`. An older
configuration object also declares `SMTP_USERNAME`/`EMAIL_FROM`; those are not
used by the current mail-sending utility.

`OPENAI_API_KEY` is currently declared but has no consumer in the AI code.
`HUGGINGFACE_API_KEY` is passed to model loading. The current implementation still
needs its model files and runtime; adding a hosted-provider key does not replace
that setup. Do not buy hosted AI access solely because the variable exists.

MoMo, ZaloPay and real refunds are currently unavailable. They are not enabled
by adding credentials to the existing code. Read-only SMTP/S3 checks have now run;
no emails, object writes, payments or refunds were performed.
