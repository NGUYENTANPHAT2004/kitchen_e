# Kitchen E

React/TypeScript storefront and management UI, Express/Mongoose commerce API,
and a Python AI service. The tested local setup is isolated from the
database and third-party credentials in `be/.env`.

## Run Locally (Windows)

Requirements: Node.js 20.19+ (tested with 24.19), npm, MongoDB 7+, and Python 3.11
with the lightweight dependencies below. Heavy face/embedding models are optional.
Run from this repository's root in PowerShell:

```powershell
npm --prefix be ci
npm --prefix fe ci
python -m pip install -r py-ai/requirements-local.txt
.\start-local.ps1 -Seed -EnableAI
```

On subsequent starts, use `.\start-local.ps1`. It starts MongoDB, Python AI, the
backend and the frontend in the background. `-EnableAI` enables chat in the local
database; omit it to preserve the enabled/disabled setting chosen in management.
Pass `-SkipAI` if you only need the commerce app, or `-PythonPath` to select a
specific Python executable. An existing `py-ai/.venv/Scripts/python.exe` is preferred.
For selective use of credentials already in `.env`, see `INTEGRATIONS.md` and
the `-Integrations` option. Default startup remains isolated from external services.
If script execution is restricted, a process-only invocation is sufficient:
`powershell -ExecutionPolicy Bypass -File .\start-local.ps1 -Seed -EnableAI`.

- Store: http://127.0.0.1:5173
- Management: http://127.0.0.1:5173/dashboard
- API health: http://127.0.0.1:5000/api/health
- Python AI health: http://127.0.0.1:8000/health
- Python API docs: http://127.0.0.1:8000/docs
- Chat tester: http://127.0.0.1:5173/ai-assistant → **Thử trò chuyện** (admin).
- Admin: `admin@kitchen.local`
- Customer: `customer@kitchen.local`
- Password for both **local test accounts only**: `KitchenLocal2026!`
- Voucher: `KITCHEN10`, 10% discount on qualifying orders.

The launcher starts services in the background, checks readiness, and reuses
matching services. It never terminates a process to free a port. To use other
ports, stop existing services first, then run for example:

```powershell
.\stop-local.ps1
.\start-local.ps1 -ApiPort 5001 -WebPort 5174 -AiPort 8001
```

Pass `-MongoPath 'C:\path\to\mongod.exe'` when MongoDB is not installed in its
standard location. The database port remains 27018. Stop the database too with
`.\stop-local.ps1 -IncludeDatabase`. Stop commands verify process ownership.

## Local Data and Services

- MongoDB: `mongodb://127.0.0.1:27018/kitchen_e_local?replicaSet=kitchenLocal`.
- Data files: `.local/mongo`; replica set initialization is automatic and
  refuses an unrelated MongoDB instance. Transactions require a replica set.
- Seed adds missing demo records without deleting existing data. It does not
  reset account passwords or overwrite edited products/settings.
- Logs: `.local/backend.log`, `.local/backend-error.log`, `.local/frontend.log`,
  `.local/frontend-error.log`, `.local/mongo.log`, `.local/python-ai.log`,
  `.local/python-ai-error.log`, `.local/python-ai-app.log`.
- Email is written to `.local/mail/*.json`, never delivered to external SMTP
  in this local mode. Verification/reset links can be inspected there.
- JWT/session secret is generated once in `.local/session-secret`.
- Local startup disables OAuth, Redis and VNPay. Python uses the same local
  database as Node, even if the Python `.env` references another database.
  Management settings display connection health and persist enabled/language.
- The chatbot currently uses Vietnamese intent patterns and response templates
  with product names/prices read from MongoDB. No hosted LLM is invoked. Face
  recognition, speech and model-based embeddings need optional packages/models.
- Bank transfer is offered only after account details are configured. The
  integration tests temporarily use clearly fake bank data and restore settings.
- `.local` is ignored by Git. Do not deploy these demo accounts or local secrets.

## Implemented Workflows

- Responsive storefront, category/search/filter/sort/pagination, product images,
  variants, customization selection, wishlist and reviews.
- Guest cart persistence, authenticated cart synchronization, account isolation,
  login/register/profile, checkout, vouchers, delivery charges and order history.
- Server-calculated prices, transactional stock reservation/cancellation,
  checkout replay responses committed in the same transaction as orders,
  controlled order transitions and management-only bank confirmation.
- Management dashboard, order details, store settings, paid sales/customer
  reports and CSV export, recipe editing/drafts/product links, Flash Sale editing,
  bundles and targeted notification creation.
- Explicit errors for unavailable gateways/refunds instead of fake success.

## Verification

```powershell
npm --prefix be test -- --runInBand
npm --prefix be run lint
npm --prefix fe test
npm --prefix fe run lint
npm --prefix fe run build
npm --prefix be run verify:local
npm --prefix be run verify:ai
npm --prefix be audit
npm --prefix fe audit
```

`verify:local` requires the seeded API on port 5000. It only connects to the fixed
local database, but **does change demo data**: it adds test customers/orders,
consumes stock for successful paid test orders, and temporarily changes shipping
and bank settings. Do not run while manually testing checkout. It restores those
settings in `finally`; paid test orders remain as traceable report data.

`verify:ai` requires all four services on the default ports, seeded accounts and
enabled chat. It verifies actual Python database selection (including replica-set
URI options), login, catalog responses and conversation persistence. It only adds
local chat logs, identified by a `local-ai-check-` session prefix; it creates no
orders and changes no stock. On September 8, 2026, all 14 assertions passed and
the chat tester was exercised in the browser.

Verified on September 7, 2026: 46 backend tests, 25 frontend tests and 57 live
commerce assertions. Browser checks cover desktop/mobile, cart/checkout,
recipe editing and management navigation. Dependency audits report zero known
vulnerabilities at verification time; this is not a security certification.

## Before Production

This is a working local build, not a completed production deployment.

- Supply real merchant details, policy content, catalog photography, prices,
  delivery rules and authorized admin accounts.
- Configure and verify SMTP, OAuth, S3/remote storage and production AI
  independently. See `py-ai/README.md`; the verified local chatbot does not
  establish that hosted LLM, face or speech integrations are configured.
- VNPay still needs provider sandbox verification and callback/redirect review.
  MoMo, ZaloPay and real refunds are unavailable. No live funds were moved.
- Validate HTTPS, strict CORS, session storage, backups/restore, monitoring,
  authorization for every operational role and deployment-specific rate limits.
  Redis adapter contract is unit-tested, not verified against a live Redis server.
- Guest-cart merge retries after an ambiguous network failure still need durable
  idempotency. Checkout replay retention is 24 hours; clients must reuse their key.
- The main frontend entry is about 454 kB before gzip after route splitting;
  one shared UI-library chunk still exceeds Vite's 500 kB warning threshold.
  The browser connection became unavailable during the final variant-page check;
  variant selections need a final manual browser pass.
- Repeat security audits and load/failure testing before accepting real orders.

## Demo Image Sources

The storefront uses local copies of the following demo image sources. Replace
them with merchant-owned catalog media before launch and review usage rights.

- Kitchen photo: `https://images.unsplash.com/photo-1556911220-bff31c812dba`
- Product images: `https://cdn.dummyjson.com/product-images/kitchen-accessories/`
  (the product slug and `1.webp` identify each local image).
