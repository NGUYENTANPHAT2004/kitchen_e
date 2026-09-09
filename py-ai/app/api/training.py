from typing import Literal
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field, ConfigDict, field_validator
from pymongo.errors import DuplicateKeyError

from app.models.intent_classifier import normalize_text
from app.services.intent_training import intent_training, public, object_id
from app.utils.service_auth import require_service_key

router = APIRouter(dependencies=[Depends(require_service_key)])


class IntentInput(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    key: str = Field(pattern=r"^[a-z][a-z0-9_]{1,59}$")
    label: str = Field(min_length=2, max_length=100)
    handler: Literal["response", "products", "recommendations", "orders", "recipes"] = "response"
    response: str = Field(default="", max_length=2000)
    enabled: bool = True

    @field_validator("key")
    @classmethod
    def reserved(cls, value):
        if value in ("general", "error"):
            raise ValueError("Mã này được dành cho phản hồi dự phòng.")
        return value


class ExampleInput(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    text: str = Field(min_length=2, max_length=2000)
    intent: str = Field(pattern=r"^[a-z][a-z0-9_]{1,59}$")
    purpose: Literal["train", "validation"] = "train"
    approved: bool = False
    sourceLogId: str | None = Field(default=None, pattern=r"^[a-fA-F0-9]{24}$")


class TrainingSettings(BaseModel):
    model_config = ConfigDict(extra="forbid")
    autoTrain: bool
    minChanges: int = Field(ge=1, le=1000)
    intervalMinutes: int = Field(ge=1, le=10080)
    minF1: float = Field(ge=0.5, le=1)
    minConfidence: float = Field(ge=0.2, le=0.95)


@router.get("/status")
async def status():
    return await intent_training.status()


@router.put("/settings")
async def settings(body: TrainingSettings):
    await intent_training.db.ai_training_control.update_one({"_id": "intent"}, {"$set": body.model_dump(), "$inc": {"settingsRevision": 1}})
    return {"settings": body.model_dump()}


@router.get("/intents")
async def intents():
    rows = await intent_training.db.ai_intents.find({}).sort("createdAt", 1).to_list(length=200)
    counts = await intent_training.db.ai_training_examples.aggregate([
        {"$group": {"_id": {"intent": "$intent", "approved": "$approved", "purpose": "$purpose"}, "count": {"$sum": 1}}}
    ]).to_list(length=None)
    for row in rows:
        own = [item for item in counts if item["_id"]["intent"] == row["key"]]
        row["trainCount"] = sum(item["count"] for item in own if item["_id"].get("approved") and item["_id"]["purpose"] == "train")
        row["validationCount"] = sum(item["count"] for item in own if item["_id"].get("approved") and item["_id"]["purpose"] == "validation")
        row["pendingCount"] = sum(item["count"] for item in own if not item["_id"].get("approved"))
    return {"intents": public(rows)}


@router.post("/intents", status_code=201)
async def create_intent(body: IntentInput):
    if body.handler == "response" and not body.response:
        raise HTTPException(400, "Vui lòng nhập câu trả lời cho intent này.")
    row = {**body.model_dump(), "createdAt": datetime.now(timezone.utc), "updatedAt": datetime.now(timezone.utc)}
    try:
        await intent_training.db.ai_intents.insert_one(row)
    except DuplicateKeyError:
        raise HTTPException(409, "Mã intent đã tồn tại.")
    await intent_training.changed()
    return public(row)


@router.put("/intents/{key}")
async def update_intent(key: str, body: IntentInput):
    if key != body.key:
        raise HTTPException(400, "Mã intent không thể đổi sau khi tạo.")
    if body.handler == "response" and not body.response:
        raise HTTPException(400, "Vui lòng nhập câu trả lời cho intent này.")
    previous = await intent_training.db.ai_intents.find_one({"key": key})
    result = await intent_training.db.ai_intents.update_one({"key": key}, {"$set": {**body.model_dump(), "updatedAt": datetime.now(timezone.utc)}})
    if not result.matched_count:
        raise HTTPException(404, "Intent không tồn tại.")
    if previous is None or any(previous.get(field) != value for field, value in body.model_dump().items()):
        await intent_training.changed()
    return body.model_dump()


@router.delete("/intents/{key}")
async def delete_intent(key: str):
    if await intent_training.db.ai_training_examples.count_documents({"intent": key}):
        raise HTTPException(409, "Intent còn câu mẫu. Bạn có thể tắt intent hoặc xóa các câu mẫu trước.")
    result = await intent_training.db.ai_intents.delete_one({"key": key})
    if not result.deleted_count:
        raise HTTPException(404, "Intent không tồn tại.")
    await intent_training.changed()
    return {"deleted": True}


@router.get("/examples")
async def examples(intent: str | None = None, approved: bool | None = None, page: int = Query(1, ge=1), limit: int = Query(20, ge=1, le=100)):
    query = {}
    if intent:
        query["intent"] = intent
    if approved is not None:
        query["approved"] = approved
    collection = intent_training.db.ai_training_examples
    total = await collection.count_documents(query)
    rows = await collection.find(query, {"normalized": 0}).sort("createdAt", -1).skip((page - 1) * limit).limit(limit).to_list(length=limit)
    return {"examples": public(rows), "pagination": {"currentPage": page, "totalPages": max(1, (total + limit - 1) // limit), "totalItems": total, "limit": limit}}


async def save_example(body, identifier=None):
    if not await intent_training.db.ai_intents.find_one({"key": body.intent}):
        raise HTTPException(400, "Intent không tồn tại.")
    row = {**body.model_dump(exclude_none=True), "normalized": normalize_text(body.text), "updatedAt": datetime.now(timezone.utc)}
    collection = intent_training.db.ai_training_examples
    previous = await collection.find_one({"_id": object_id(identifier)}) if identifier else None
    try:
        if identifier:
            result = await collection.update_one({"_id": object_id(identifier)}, {"$set": row})
            if not result.matched_count:
                raise HTTPException(404, "Câu mẫu không tồn tại.")
        else:
            row.update({"source": "conversation" if body.sourceLogId else "manual", "createdAt": datetime.now(timezone.utc)})
            result = await collection.insert_one(row)
            identifier = str(result.inserted_id)
    except DuplicateKeyError:
        raise HTTPException(409, "Câu mẫu đã tồn tại. Hãy chỉnh sửa mẫu cũ để tránh trùng tập học và tập kiểm tra.")
    changed = previous is None or any(previous.get(field) != row[field] for field in ("text", "intent", "purpose", "approved"))
    if changed and (body.approved or (previous and previous.get("approved"))):
        await intent_training.changed()
    return public(await collection.find_one({"_id": object_id(identifier)}, {"normalized": 0}))


@router.post("/examples", status_code=201)
async def create_example(body: ExampleInput):
    return await save_example(body)


@router.put("/examples/{identifier}")
async def update_example(identifier: str, body: ExampleInput):
    return await save_example(body, identifier)


@router.delete("/examples/{identifier}")
async def delete_example(identifier: str):
    result = await intent_training.db.ai_training_examples.find_one_and_delete({"_id": object_id(identifier)})
    if not result:
        raise HTTPException(404, "Câu mẫu không tồn tại.")
    if result.get("approved"):
        await intent_training.changed()
    return {"deleted": True}


@router.post("/train", status_code=202)
async def train():
    return await intent_training.start()


@router.post("/versions/{identifier}/activate")
async def activate(identifier: str):
    return await intent_training.activate(identifier)
