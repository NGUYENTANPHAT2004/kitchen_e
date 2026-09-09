import asyncio
import hashlib
import logging
from datetime import datetime, timedelta, timezone
from pathlib import Path

import joblib
from bson import ObjectId
from fastapi import HTTPException
from pymongo import ReturnDocument

from app.config import settings
from app.data.intent_seed import SEED_INTENTS
from app.models.intent_classifier import fit_classifier, normalize_text, predict_intent
from app.utils.db_connector import mongo_client

logger = logging.getLogger(__name__)
DEFAULTS = {"autoTrain": False, "minChanges": 5, "intervalMinutes": 60, "minF1": 0.65, "minConfidence": 0.4}


def now():
    return datetime.now(timezone.utc)


def public(document):
    if isinstance(document, dict):
        return {("id" if key == "_id" else key): public(value) for key, value in document.items() if key != "artifactSha"}
    if isinstance(document, list):
        return [public(value) for value in document]
    if isinstance(document, ObjectId):
        return str(document)
    if isinstance(document, datetime):
        return document.replace(tzinfo=timezone.utc).isoformat()
    return document


def object_id(value):
    if not ObjectId.is_valid(value):
        raise HTTPException(400, "Mã dữ liệu không hợp lệ.")
    return ObjectId(value)


class IntentTraining:
    def __init__(self):
        self.artifact = None
        self.active_id = None
        self.artifact_error = None
        self.tasks = set()
        self.scheduler = None

    @property
    def db(self):
        return mongo_client.db

    def artifact_path(self, version_id):
        identifier = str(object_id(version_id))
        root = Path(settings.INTENT_MODEL_PATH).resolve()
        root.mkdir(parents=True, exist_ok=True)
        return root / f"{identifier}.joblib"

    async def initialize(self):
        await self.db.ai_intents.create_index("key", unique=True)
        await self.db.ai_training_examples.create_index("normalized", unique=True)
        await self.db.ai_training_examples.create_index([("approved", 1), ("intent", 1)])
        await self.db.ai_model_versions.create_index([("createdAt", -1)])
        await self.db.ai_training_control.update_one({"_id": "intent"}, {"$setOnInsert": {
            **DEFAULTS, "revision": 0, "lastAttemptRevision": 0, "runningJobId": None,
            "activeVersionId": None, "activationRevision": 0, "settingsRevision": 0, "seeded": False,
        }}, upsert=True)
        for field in ("activationRevision", "settingsRevision"):
            await self.db.ai_training_control.update_one({"_id": "intent", field: {"$exists": False}}, {"$set": {field: 0}})
        control = await self.control()
        if not control.get("seeded"):
            for item in SEED_INTENTS:
                intent = {key: value for key, value in item.items() if key not in ("train", "validation")}
                await self.db.ai_intents.update_one({"key": item["key"]}, {"$setOnInsert": {**intent, "enabled": True, "createdAt": now(), "updatedAt": now()}}, upsert=True)
                for purpose in ("train", "validation"):
                    for text in item[purpose]:
                        await self.db.ai_training_examples.update_one({"normalized": normalize_text(text)}, {"$setOnInsert": {
                            "text": text, "intent": item["key"], "purpose": purpose, "approved": True,
                            "source": "starter", "createdAt": now(), "updatedAt": now(),
                        }}, upsert=True)
            await self.db.ai_training_control.update_one({"_id": "intent"}, {"$set": {"seeded": True}, "$inc": {"revision": 1}})
        await self.refresh_active()
        self.scheduler = asyncio.create_task(self.schedule())

    async def close(self):
        tasks = list(self.tasks) + ([self.scheduler] if self.scheduler else [])
        for task in tasks:
            task.cancel()
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)

    async def control(self):
        return await self.db.ai_training_control.find_one({"_id": "intent"}) or {**DEFAULTS, "revision": 0}

    async def changed(self):
        await self.db.ai_training_control.update_one({"_id": "intent"}, {"$inc": {"revision": 1}})

    async def load_artifact(self, version):
        path = self.artifact_path(str(version["_id"]))
        def load():
            if not path.is_file() or hashlib.sha256(path.read_bytes()).hexdigest() != version.get("artifactSha"):
                raise ValueError("Tệp model không tồn tại hoặc không còn nguyên vẹn. Vui lòng huấn luyện lại.")
            # Only internally generated, checksum-verified artifacts are loaded.
            return joblib.load(path)
        return await asyncio.to_thread(load)

    async def refresh_active(self):
        control = await self.control()
        version_id = control.get("activeVersionId")
        if version_id == self.active_id and (self.artifact is not None or version_id is None):
            return
        try:
            version = await self.db.ai_model_versions.find_one({"_id": object_id(version_id)}) if version_id else None
            artifact = await self.load_artifact(version) if version else None
            self.artifact, self.active_id, self.artifact_error = artifact, version_id, None
        except Exception as error:
            self.artifact, self.active_id = None, None
            self.artifact_error = str(error)
            logger.error("Cannot load active intent model: %s", error)

    async def classify(self, text):
        await self.refresh_active()
        if self.artifact is None:
            return None
        control = await self.control()
        result = predict_intent(self.artifact, text, control.get("minConfidence", 0.4))
        definition = self.artifact["intents"].get(result["intent"])
        if definition and not await self.db.ai_intents.find_one({"key": result["intent"], "enabled": True}):
            result["intent"], definition = "general", None
        return {**result, "version": self.active_id, "definition": definition}

    async def status(self):
        await self.recover_expired_job()
        await self.refresh_active()
        control = await self.control()
        versions = await self.db.ai_model_versions.find({}, {"artifactSha": 0}).sort("createdAt", -1).limit(20).to_list(length=20)
        if control.get("activeVersionId") and not any(str(item["_id"]) == control["activeVersionId"] for item in versions):
            active = await self.db.ai_model_versions.find_one({"_id": object_id(control["activeVersionId"])}, {"artifactSha": 0})
            if active:
                versions.append(active)
        counts = await self.db.ai_training_examples.aggregate([
            {"$group": {"_id": {"approved": "$approved", "purpose": "$purpose"}, "count": {"$sum": 1}}}
        ]).to_list(length=None)
        return public({
            "settings": {key: control.get(key, value) for key, value in DEFAULTS.items()},
            "activeVersionId": control.get("activeVersionId"), "runningJobId": control.get("runningJobId"),
            "pendingChanges": max(0, control.get("revision", 0) - control.get("lastAttemptRevision", 0)),
            "lastRunAt": control.get("lastRunAt"), "versions": versions,
            "trainingSamples": sum(row["count"] for row in counts if row["_id"].get("approved") and row["_id"].get("purpose") == "train"),
            "validationSamples": sum(row["count"] for row in counts if row["_id"].get("approved") and row["_id"].get("purpose") == "validation"),
            "pendingSamples": sum(row["count"] for row in counts if not row["_id"].get("approved")),
            "artifactError": self.artifact_error,
        })

    async def start(self, automatic=False):
        version_id = ObjectId()
        control = await self.db.ai_training_control.find_one_and_update(
            {"_id": "intent", "$or": [{"runningJobId": None}, {"leaseUntil": {"$lt": now()}}]},
            {"$set": {"runningJobId": str(version_id), "leaseUntil": now() + timedelta(minutes=30)}},
            return_document=ReturnDocument.BEFORE,
        )
        if control is None:
            raise HTTPException(409, "Một lượt huấn luyện đang chạy. Vui lòng đợi kết quả.")
        if control.get("runningJobId"):
            await self.db.ai_model_versions.update_one({"_id": object_id(control["runningJobId"]), "status": "running"}, {"$set": {"status": "failed", "error": "Lượt huấn luyện trước đã bị gián đoạn.", "completedAt": now()}})
        version = {"_id": version_id, "name": f"intent-{now():%Y%m%d-%H%M%S}-{str(version_id)[-4:]}", "status": "running", "trigger": "automatic" if automatic else "manual", "sourceRevision": control.get("revision", 0), "createdAt": now()}
        try:
            await self.db.ai_model_versions.insert_one(version)
            await self.db.ai_training_control.update_one({"_id": "intent"}, {"$set": {"lastAttemptRevision": control.get("revision", 0), "lastRunAt": now()}})
        except Exception:
            await self.db.ai_training_control.update_one({"_id": "intent", "runningJobId": str(version_id)}, {"$set": {"runningJobId": None}, "$unset": {"leaseUntil": ""}})
            raise
        task = asyncio.create_task(self.run(version, control))
        self.tasks.add(task)
        task.add_done_callback(self.tasks.discard)
        return public(version)

    async def run(self, version, control):
        identifier = version["_id"]
        try:
            intents = await self.db.ai_intents.find({"enabled": True}).to_list(length=200)
            examples = await self.db.ai_training_examples.find({"approved": True}).limit(10001).to_list(length=10001)
            if len(examples) > 10000:
                raise ValueError("Lượt huấn luyện hiện hỗ trợ tối đa 10.000 câu mẫu.")
            artifact = await asyncio.to_thread(fit_classifier, intents, examples)
            destination = self.artifact_path(str(identifier))
            def persist():
                temporary = destination.with_suffix(".tmp")
                joblib.dump(artifact, temporary)
                temporary.replace(destination)
                return hashlib.sha256(destination.read_bytes()).hexdigest()
            checksum = await asyncio.to_thread(persist)
            updates = {key: artifact[key] for key in ("metrics", "datasetHash", "validationHash", "sampleIds")}
            updates.update({"status": "ready", "artifactSha": checksum, "completedAt": now(), "eligible": artifact["metrics"]["macroF1"] >= control.get("minF1", 0.65)})
            await self.db.ai_model_versions.update_one({"_id": identifier}, {"$set": updates})
            if version["trigger"] == "automatic":
                latest = await self.control()
                active = await self.db.ai_model_versions.find_one({"_id": object_id(latest["activeVersionId"])}) if latest.get("activeVersionId") else None
                same_benchmark = not active or active.get("validationHash") == artifact["validationHash"]
                not_worse = not active or artifact["metrics"]["macroF1"] >= active.get("metrics", {}).get("macroF1", 0)
                unchanged_active = latest.get("activeVersionId") == control.get("activeVersionId")
                meets_threshold = artifact["metrics"]["macroF1"] >= latest.get("minF1", 0.65)
                if latest.get("autoTrain") and unchanged_active and meets_threshold and same_benchmark and not_worse:
                    await self.activate(str(identifier), automatic_control=control)
                else:
                    await self.db.ai_model_versions.update_one({"_id": identifier}, {"$set": {"activationNote": "Chờ kiểm tra: chưa đạt ngưỡng, điểm giảm hoặc tập kiểm tra đã thay đổi."}})
        except asyncio.CancelledError:
            await self.db.ai_model_versions.update_one({"_id": identifier}, {"$set": {"status": "failed", "error": "Dịch vụ dừng trong khi huấn luyện.", "completedAt": now()}})
            raise
        except Exception as error:
            logger.exception("Intent training failed")
            await self.db.ai_model_versions.update_one({"_id": identifier}, {"$set": {"status": "failed", "error": str(error), "completedAt": now()}})
        finally:
            await self.db.ai_training_control.update_one({"_id": "intent", "runningJobId": str(identifier)}, {"$set": {"runningJobId": None}, "$unset": {"leaseUntil": ""}})

    async def activate(self, version_id, automatic_control=None):
        version = await self.db.ai_model_versions.find_one({"_id": object_id(version_id), "status": "ready"})
        if not version:
            raise HTTPException(404, "Phiên bản chưa sẵn sàng hoặc không tồn tại.")
        control = await self.control()
        if version["metrics"]["macroF1"] < control.get("minF1", 0.65):
            if automatic_control is not None:
                await self.db.ai_model_versions.update_one({"_id": version["_id"]}, {"$set": {"activationNote": "Chờ kiểm tra: chưa đạt ngưỡng F1 hiện tại."}})
                return {"activated": False}
            raise HTTPException(400, "Phiên bản chưa đạt ngưỡng F1 tối thiểu đã cấu hình.")
        try:
            artifact = await self.load_artifact(version)
        except ValueError as error:
            raise HTTPException(409, str(error))
        # Compare-and-set after loading the file: an administrator may have
        # disabled automation, changed the threshold or rolled back meanwhile.
        expected = automatic_control if automatic_control is not None else control
        query = {"_id": "intent", "activationRevision": expected.get("activationRevision", 0),
                 "settingsRevision": expected.get("settingsRevision", 0)}
        if automatic_control is not None:
            query.update({"autoTrain": True, "activeVersionId": expected.get("activeVersionId"),
                          "revision": expected.get("revision", 0), "runningJobId": version_id,
                          "leaseUntil": {"$gte": now()}})
        result = await self.db.ai_training_control.update_one(query, {
            "$set": {"activeVersionId": version_id}, "$inc": {"activationRevision": 1},
        })
        if not result.matched_count:
            if automatic_control is not None:
                await self.db.ai_model_versions.update_one({"_id": version["_id"]}, {"$set": {
                    "activationNote": "Chờ kiểm tra: dữ liệu, cài đặt hoặc model đang dùng đã thay đổi trong lúc huấn luyện.",
                }})
                return {"activated": False}
            raise HTTPException(409, "Cài đặt hoặc model đang dùng vừa thay đổi. Vui lòng cập nhật và thử lại.")
        self.artifact, self.active_id, self.artifact_error = artifact, version_id, None
        return {"activeVersionId": version_id}

    async def recover_expired_job(self):
        control = await self.db.ai_training_control.find_one_and_update(
            {"_id": "intent", "runningJobId": {"$ne": None}, "leaseUntil": {"$lt": now()}},
            {"$set": {"runningJobId": None}, "$unset": {"leaseUntil": ""}},
            return_document=ReturnDocument.BEFORE,
        )
        if control and control.get("runningJobId"):
            await self.db.ai_model_versions.update_one({"_id": object_id(control["runningJobId"]), "status": "running"}, {"$set": {"status": "failed", "error": "Lượt huấn luyện bị gián đoạn hoặc quá thời gian. Có thể huấn luyện lại.", "completedAt": now()}})

    async def auto_tick(self):
        await self.recover_expired_job()
        control = await self.control()
        if not control.get("autoTrain") or control.get("runningJobId"):
            return False
        if control.get("revision", 0) - control.get("lastAttemptRevision", 0) < control.get("minChanges", 5):
            return False
        previous = control.get("lastRunAt")
        if previous and now() - previous.replace(tzinfo=timezone.utc) < timedelta(minutes=control.get("intervalMinutes", 60)):
            return False
        await self.start(automatic=True)
        return True

    async def schedule(self):
        while True:
            await asyncio.sleep(30)
            try:
                await self.auto_tick()
            except Exception:
                logger.exception("Automatic intent training check failed")


intent_training = IntentTraining()
