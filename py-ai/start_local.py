"""Run Python AI against the same isolated database as the Node local launcher."""
import os
from pathlib import Path
import secrets
import sys

LOCAL_MONGODB_URI = "mongodb://127.0.0.1:27018/kitchen_e_local?replicaSet=kitchenLocal"


def configure_local():
    from dotenv import load_dotenv

    project = Path(__file__).resolve().parent
    local = project.parent / ".local"
    local.mkdir(exist_ok=True)
    os.chdir(project)
    load_dotenv(project / ".env", override=False)
    secret_path = local / "python-ai-secret"
    try:
        with secret_path.open("x", encoding="utf-8") as secret_file:
            secret_file.write(secrets.token_hex(48))
    except FileExistsError:
        pass
    port = int(os.getenv("LOCAL_AI_PORT", "8000"))
    api_port = int(os.getenv("LOCAL_API_PORT", "5000"))
    if not all(1024 <= value <= 65535 for value in (port, api_port)):
        raise ValueError("Local API and AI ports must be between 1024 and 65535")
    os.environ.update({
        "MONGODB_URI": LOCAL_MONGODB_URI,
        "NODE_BACKEND_URL": f"http://127.0.0.1:{api_port}",
        "PORT": str(port),
        "DEBUG": "false",
        "MODEL_PATH": str(project / "data" / "models"),
        "EMBEDDINGS_PATH": str(local / "python-ai" / "embeddings"),
        "TEMP_PATH": str(local / "python-ai" / "temp"),
        "KITCHEN_AI_LOG_PATH": str(local / "python-ai-app.log"),
        "ENABLE_CACHE": "false",
        "REDIS_URL": "",
        "SECRET_KEY": secret_path.read_text(encoding="utf-8"),
        "AI_SERVICE_KEY": secret_path.read_text(encoding="utf-8"),
        "INTENT_MODEL_PATH": str(local / "python-ai" / "intents"),
    })
    return port


def main():
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, "reconfigure"):
            stream.reconfigure(encoding="utf-8", line_buffering=True)
    port = configure_local()
    import uvicorn

    uvicorn.run("app.main:app", host="127.0.0.1", port=port, reload=False)


if __name__ == "__main__":
    main()
