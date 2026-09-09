# Kitchen E Python AI — local testing

From the repository root in PowerShell:

```powershell
python -m pip install -r py-ai/requirements-local.txt
.\start-local.ps1 -Seed -EnableAI
```

The root launcher starts the four services and waits for health checks. Python
3.11 was used for the local check. Use `-PythonPath 'C:\path\to\python.exe'` if
the required packages are installed in a different interpreter. No model download
is required for the catalog chatbot. `requirements.txt` describes the older full
ML stack; `requirements-local.txt` is the lightweight set used for this local run.

- Store: `http://127.0.0.1:5173`
- Model management: `http://127.0.0.1:5173/ai-assistant`.
- Customer assistant: `http://127.0.0.1:5173/shop/assistant`, also available through
  **Trợ lý AI** in the store navigation and the floating chat button.
- Python readiness: `http://127.0.0.1:8000/health`
- Interactive API docs: `http://127.0.0.1:8000/docs`
- Admin account: `admin@kitchen.local` / `KitchenLocal2026!` (local demo only).

To start only Python after MongoDB is running:

```powershell
python -X utf8 -u py-ai/start_local.py
```

`start_local.py` loads the existing Python `.env`, then pins the database to
`mongodb://127.0.0.1:27018/kitchen_e_local?replicaSet=kitchenLocal`, matching Node.
It binds to loopback, disables Redis, puts temporary data and logs under `.local`,
and uses a generated local secret. Existing `.env` files are not rewritten.
The normal `run.py` entry point keeps its environment-configured behavior.

Readiness includes a live MongoDB ping and requires the product catalog/chat
model to initialize. The response reports the database name, catalog size and
chat mode. URI query options are parsed by the MongoDB driver.

The initial mode is `catalog-rules`. After training and activating a version,
the mode becomes `trained-intent`: a CPU classifier using character TF-IDF and
logistic regression. Its predicted intent selects a reviewed response or a
product/recipe lookup. This trains a real intent model, not a generative LLM.
Declaring an `OPENAI_API_KEY` does not enable a provider: chat does not call it.
Face/speech and embedding models need their optional dependencies and assets.
Order questions direct users to their order history rather than inventing a
shipment status. Product suggestions refresh from MongoDB for each lookup;
recipe suggestions include only published, nondeleted recipes.

## Training workflow

1. Sign in as the local administrator and open **Trợ lý AI**.
2. In **Intent**, add or edit a label and choose its response or lookup handler.
3. In **Câu mẫu**, add questions, select the correct intent and choose either
   **Tập học** or **Tập kiểm tra riêng**. Approve only after checking the label.
   **Hội thoại** lists actual chat sessions and lets an administrator turn a
   customer question into a labelled example; no session ID needs to be pasted.
4. In **Model & huấn luyện**, select **Huấn luyện phiên bản mới**. The asynchronous
   job creates an artifact and reports accuracy, macro F1, per-intent metrics
   and each validation mistake. The page refreshes while training runs.
5. Review the evaluation and select **Kích hoạt phiên bản**. Customer chat now
   uses that version. Activating an older ready version performs a rollback.

The starter dataset contains 8 intents, 84 training and 24 held-out validation
questions. Each enabled intent requires at least 3 approved training questions
and 2 approved validation questions, with at least 2 enabled intents. Normalized
duplicates are rejected across labels and splits. Pending questions never train
the model. The current training job supports up to 10,000 approved examples.
Validation results describe this small dataset, not production accuracy.

Automatic training is off by default. When enabled, the scheduler checks every
30 seconds, requires the configured number of reviewed-data changes and obeys
the cooldown. Saving unchanged text does not count as a new change. A candidate
can automatically activate only when it meets the F1 threshold, does not reduce
F1 on the same validation set and the configuration, reviewed data and active
model have not changed meanwhile. Otherwise it remains ready for review. Votes
on answers are review signals, never automatically accepted training labels.

Model metadata and settings are stored in `ai_model_versions` and
`ai_training_control`; intents and examples in `ai_intents` and
`ai_training_examples`. Local artifacts are stored under
`.local/python-ai/intents`. Restarting Python reloads the active version from
MongoDB and checks the artifact checksum. Keep both MongoDB and these artifacts
when backing up or moving the installation.

## Service authentication

The local launchers share a generated key from `.local/python-ai-secret`.
Normal environment-based startup requires the same `AI_SERVICE_KEY` in Node
and Python, passed internally as `X-AI-Service-Key`; it must never be a VITE
variable. Python chat/training endpoints require it. Browser clients use Node,
which restricts all training and conversation administration to administrators.

Node records each successful text-chat exchange once in `aiassistantlogs`.
Chat continuation uses a signed token bound to the account or guest session.
Guest history and feedback require that token; signed-in users can access only
their own records, while administrators can review conversations. A new account
gets its own frontend session. Use a stable `AI_SESSION_SECRET` (or JWT secret)
when deploying if conversations must survive backend restarts.

Verify the full Node → Python → MongoDB path from the repository root:

```powershell
npm --prefix be run verify:ai
```

This uses the default ports and creates three local customer chat logs only.
It checks both test logins, profile-polling rate-limit regression, shared database readiness, product/image serialization,
actual catalog prices and persisted conversations. It does not send emails,
upload files to cloud storage, create orders or move funds.

With local MongoDB running, run the actual classifier and isolated database tests:

```powershell
cd py-ai
python -m pytest training_tests -q
python -m pytest tests/test_chat.py tests/test_chat_model_nlp.py -q
```

Run these as separate commands: legacy `tests/conftest.py` mocks native/ML
dependencies. `training_tests` uses real sklearn and uniquely named
`kitchen_ai_test_*` databases on port 27018, deletes only its own scratch database
and uses temporary artifacts. It verifies training/activation, reload/rollback,
custom responses, held-out validation, review/duplicate checks, authorization,
automatic gates, concurrency and checksum failures. Test tooling additionally
requires `pytest` and `httpx`.

Stop frontend, backend and Python with `.\stop-local.ps1`. Add `-IncludeDatabase`
to also stop MongoDB. With custom ports, pass the same `-ApiPort`, `-WebPort`
and `-AiPort` values to the stop command. Logs are `.local/python-ai.log`,
`.local/python-ai-error.log` and `.local/python-ai-app.log`.
