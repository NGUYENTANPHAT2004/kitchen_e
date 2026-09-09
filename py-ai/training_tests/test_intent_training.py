"""Real sklearn + local Mongo tests. Run separately from the legacy mocked tests/."""
import asyncio
from datetime import timedelta
from uuid import uuid4

import joblib
import pytest
from bson import ObjectId
from fastapi import FastAPI, HTTPException
from httpx import ASGITransport, AsyncClient
from motor.motor_asyncio import AsyncIOMotorClient

from app.api import training as api
from app.config import settings
from app.data.intent_seed import SEED_INTENTS
from app.models.intent_classifier import fit_classifier, normalize_text, predict_intent
from app.services.intent_training import IntentTraining, now
from app.utils.db_connector import mongo_client


def seed_rows():
    intents = [{k: v for k, v in item.items() if k not in ("train", "validation")} for item in SEED_INTENTS]
    rows = [{"text": text, "intent": item["key"], "purpose": purpose, "approved": True}
            for item in SEED_INTENTS for purpose in ("train", "validation") for text in item[purpose]]
    return intents, rows


def test_real_fit_has_held_out_metrics_and_survives_serialization(tmp_path):
    intents, rows = seed_rows()
    artifact = fit_classifier(intents, rows)
    assert artifact["metrics"]["trainingSamples"] == 84
    assert artifact["metrics"]["validationSamples"] == 24
    assert artifact["metrics"]["macroF1"] > 0.8
    vocabulary = artifact["pipeline"].named_steps["tfidf"].vocabulary_
    assert "frees" not in vocabulary  # Only occurs in the held-out shipping example.
    destination = tmp_path / "model.joblib"
    joblib.dump(artifact, destination)
    restored = joblib.load(destination)
    assert predict_intent(restored, "Chảo")["intent"] == "product_inquiry"
    assert predict_intent(restored, "🛰🛰🛰") == {"intent": "general", "confidence": 0.0}
    assert predict_intent(restored, "Chảo", threshold=1)["intent"] == "general"


def test_duplicate_across_labels_or_splits_is_rejected():
    intents, rows = seed_rows()
    rows.append({**rows[0], "text": "  XIN CHAO  ", "purpose": "validation", "intent": "order_status"})
    with pytest.raises(ValueError, match="trùng"):
        fit_classifier(intents, rows)


def test_pending_examples_do_not_satisfy_minimums():
    intents, rows = seed_rows()
    for row in rows:
        if row["intent"] == "greeting" and row["purpose"] == "validation":
            row["approved"] = False
    with pytest.raises(ValueError, match="greeting"):
        fit_classifier(intents, rows)
    with pytest.raises(ValueError, match="ít nhất 2"):
        fit_classifier(intents[:1], rows)


@pytest.fixture
def harness(tmp_path, monkeypatch):
    loop = asyncio.new_event_loop()
    name = "kitchen_ai_test_" + uuid4().hex
    client = AsyncIOMotorClient("mongodb://127.0.0.1:27018/?replicaSet=kitchenLocal", io_loop=loop, serverSelectionTimeoutMS=3000)
    monkeypatch.setattr(mongo_client, "client", client)
    monkeypatch.setattr(mongo_client, "db", client[name])
    monkeypatch.setattr(mongo_client, "initialized", True)
    monkeypatch.setattr(settings, "INTENT_MODEL_PATH", str(tmp_path / "intents"))
    monkeypatch.setattr(settings, "AI_SERVICE_KEY", "isolated-training-test-key")
    runtime = IntentTraining()
    monkeypatch.setattr(api, "intent_training", runtime)

    async def setup():
        await runtime.initialize()
        runtime.scheduler.cancel()
        await asyncio.gather(runtime.scheduler, return_exceptions=True)
        runtime.scheduler = None

    try:
        loop.run_until_complete(setup())
        yield runtime, loop.run_until_complete
    finally:
        loop.run_until_complete(runtime.close())
        assert name.startswith("kitchen_ai_test_") and len(name) == 48
        loop.run_until_complete(client.drop_database(name))
        client.close()
        loop.close()


async def train_ready(runtime, automatic=False):
    version = await runtime.start(automatic=automatic)
    await asyncio.gather(*list(runtime.tasks))
    stored = await runtime.db.ai_model_versions.find_one({"_id": ObjectId(version["id"])})
    assert stored["status"] == "ready", stored.get("error")
    return version["id"]


def test_train_activate_reload_custom_response_and_rollback(harness):
    runtime, run = harness

    async def scenario():
        original = await train_ready(runtime)
        assert (await runtime.control())["activeVersionId"] is None
        await runtime.activate(original)
        assert (await runtime.classify("Chảo"))["version"] == original
        await api.create_intent(api.IntentInput(key="gift_wrapping", label="Gói quà", response="Bạn chọn gói quà tại quầy hỗ trợ."))
        for purpose, texts in {
            "train": ["Tôi muốn gói quà", "Có dịch vụ gói quà không", "Hộp quà tặng có nơ", "Nhờ cửa hàng bọc gói quà"],
            "validation": ["Cho hỏi gói quà tặng", "Dịch vụ bọc quà của shop"],
        }.items():
            for text in texts:
                await api.create_example(api.ExampleInput(text=text, intent="gift_wrapping", purpose=purpose, approved=True))
        candidate = await train_ready(runtime)
        await runtime.activate(candidate)
        reloaded = IntentTraining()
        await reloaded.refresh_active()
        result = await reloaded.classify("Tôi muốn gói quà")
        assert result["intent"] == "gift_wrapping" and result["version"] == candidate
        from app.models.chat_model import ChatModel
        chat = ChatModel()
        chat.initialized = True
        chat.intent_runtime = reloaded
        reply = await chat.generate_response("Tôi muốn gói quà")
        assert reply["response"] == "Bạn chọn gói quà tại quầy hỗ trợ."
        await runtime.activate(original)
        result = await reloaded.classify("Tôi muốn gói quà")
        assert result["version"] == original and result["intent"] != "gift_wrapping"

    run(scenario())


def test_api_auth_validation_review_revision_and_duplicate_conflict(harness):
    runtime, run = harness

    async def scenario():
        app = FastAPI()
        app.include_router(api.router, prefix="/training")
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            assert (await client.get("/training/status")).status_code == 401
            client.headers["X-AI-Service-Key"] = settings.AI_SERVICE_KEY
            assert (await client.get("/training/status")).status_code == 200
            before = (await runtime.control())["revision"]
            body = {"text": "Cửa hàng có bán chảo vuông không", "intent": "product_inquiry", "approved": False}
            created = await client.post("/training/examples", json=body)
            assert created.status_code == 201
            assert (await runtime.control())["revision"] == before
            identifier = created.json()["id"]
            duplicate = await client.post("/training/examples", json={**body, "text": normalize_text(body["text"]), "purpose": "validation"})
            assert duplicate.status_code == 409
            assert (await client.put(f"/training/examples/{identifier}", json={**body, "approved": True})).status_code == 200
            assert (await runtime.control())["revision"] == before + 1
            assert (await client.put(f"/training/examples/{identifier}", json={**body, "approved": True})).status_code == 200
            assert (await runtime.control())["revision"] == before + 1  # Saving unchanged text is not new training data.
            assert (await client.delete(f"/training/examples/{identifier}")).status_code == 200
            assert (await runtime.control())["revision"] == before + 2
            assert (await client.post("/training/examples", json={**body, "intent": "missing"})).status_code == 400
            assert (await client.post("/training/examples", json={**body, "purpose": "invalid"})).status_code == 422
            assert (await client.delete("/training/intents/greeting")).status_code == 409
            control = await runtime.control()
            config = {key: control[key] for key in api.TrainingSettings.model_fields}
            assert (await client.put("/training/settings", json=config)).status_code == 200
            assert (await runtime.control())["settingsRevision"] == control["settingsRevision"] + 1

    run(scenario())


def test_automatic_training_requires_reviewed_changes_and_obeys_cooldown(harness):
    runtime, run = harness

    async def scenario():
        assert await runtime.auto_tick() is False
        await runtime.db.ai_training_control.update_one({"_id": "intent"}, {"$set": {"autoTrain": True, "minChanges": 2}})
        await api.create_example(api.ExampleInput(text="Chào shop Kitchen hôm nay", intent="greeting"))
        assert await runtime.auto_tick() is False
        await api.create_example(api.ExampleInput(text="Xin chào cả nhà Kitchen", intent="greeting", approved=True))
        assert await runtime.auto_tick() is True
        await asyncio.gather(*list(runtime.tasks))
        control = await runtime.control()
        assert control["activeVersionId"] is not None
        await runtime.changed()
        await runtime.changed()
        assert await runtime.auto_tick() is False
        await runtime.db.ai_training_control.update_one({"_id": "intent"}, {"$set": {"lastRunAt": now() - timedelta(hours=2)}})
        assert await runtime.auto_tick() is True
        await asyncio.gather(*list(runtime.tasks))
        assert (await runtime.control())["activeVersionId"] != control["activeVersionId"]

    run(scenario())


@pytest.mark.parametrize("change", ["benchmark", "threshold", "regression"])
def test_automatic_candidate_waits_when_evaluation_gate_fails(harness, change):
    runtime, run = harness

    async def scenario():
        original = await train_ready(runtime)
        await runtime.activate(original)
        await runtime.db.ai_training_control.update_one({"_id": "intent"}, {"$set": {"autoTrain": True}})
        if change == "benchmark":
            await api.create_example(api.ExampleInput(text="Chào buổi trưa cửa hàng", intent="greeting", purpose="validation", approved=True))
        elif change == "threshold":
            await runtime.db.ai_training_control.update_one({"_id": "intent"}, {"$set": {"minF1": 1}})
        else:
            await runtime.db.ai_model_versions.update_one({"_id": ObjectId(original)}, {"$set": {"metrics.macroF1": 1}})
        candidate = await train_ready(runtime, automatic=True)
        assert (await runtime.control())["activeVersionId"] == original
        row = await runtime.db.ai_model_versions.find_one({"_id": ObjectId(candidate)})
        assert row.get("activationNote")

    run(scenario())


@pytest.mark.parametrize("change", ["settings", "active", "data"])
def test_changes_during_artifact_load_cannot_be_overwritten_by_automation(harness, monkeypatch, change):
    runtime, run = harness

    async def scenario():
        original = await train_ready(runtime)
        await runtime.activate(original)
        await runtime.db.ai_training_control.update_one({"_id": "intent"}, {"$set": {"autoTrain": True}})
        load = runtime.load_artifact

        async def racing_load(version):
            artifact = await load(version)
            if change == "settings":
                await runtime.db.ai_training_control.update_one({"_id": "intent"}, {"$set": {"autoTrain": False}, "$inc": {"settingsRevision": 1}})
            elif change == "active":
                await runtime.db.ai_training_control.update_one({"_id": "intent"}, {"$inc": {"activationRevision": 1}})
            else:
                await runtime.changed()
            return artifact

        monkeypatch.setattr(runtime, "load_artifact", racing_load)
        candidate = await train_ready(runtime, automatic=True)
        assert (await runtime.control())["activeVersionId"] == original
        row = await runtime.db.ai_model_versions.find_one({"_id": ObjectId(candidate)})
        assert "đã thay đổi" in row["activationNote"]

    run(scenario())


def test_single_running_job_expiry_failed_data_and_checksum_recovery(harness):
    runtime, run = harness

    async def scenario():
        stale = ObjectId()
        await runtime.db.ai_model_versions.insert_one({"_id": stale, "status": "running"})
        await runtime.db.ai_training_control.update_one({"_id": "intent"}, {"$set": {"runningJobId": str(stale), "leaseUntil": now() + timedelta(minutes=2)}})
        with pytest.raises(HTTPException) as caught:
            await runtime.start()
        assert caught.value.status_code == 409
        await runtime.db.ai_training_control.update_one({"_id": "intent"}, {"$set": {"leaseUntil": now() - timedelta(seconds=1)}})
        await runtime.recover_expired_job()
        assert (await runtime.control())["runningJobId"] is None
        assert (await runtime.db.ai_model_versions.find_one({"_id": stale}))["status"] == "failed"
        version = await train_ready(runtime)
        runtime.artifact_path(version).write_bytes(b"corrupted test artifact")
        with pytest.raises(HTTPException) as caught:
            await runtime.activate(version)
        assert caught.value.status_code == 409
        await runtime.db.ai_training_examples.update_many({"intent": "greeting"}, {"$set": {"approved": False}})
        failed = await runtime.start()
        await asyncio.gather(*list(runtime.tasks))
        assert (await runtime.db.ai_model_versions.find_one({"_id": ObjectId(failed["id"])}))["status"] == "failed"
        assert (await runtime.control())["runningJobId"] is None

    run(scenario())
