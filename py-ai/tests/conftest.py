"""
conftest.py – stub mọi heavy/native dependency và app internal modules
trước khi pytest collect bất kỳ test nào.
"""
import sys
import types
import asyncio
from unittest.mock import MagicMock, AsyncMock


def _mock(name, **attrs):
    m = MagicMock(name=name)
    for k, v in attrs.items():
        setattr(m, k, v)
    sys.modules.setdefault(name, m)
    return m


# ── ML / native packages ──────────────────────────────────────────────────
_torch = _mock("torch")
_torch.cuda.is_available.return_value = False
_torch.device.return_value = "cpu"
_torch.no_grad.return_value.__enter__ = MagicMock(return_value=None)
_torch.no_grad.return_value.__exit__ = MagicMock(return_value=False)

_mock("transformers")
_mock("dlib")
_mock("cv2")
_mock("scipy")
_mock("scipy.spatial")
_mock("scipy.spatial.distance")
_mock("pydub")
_mock("soundfile")
_mock("underthesea")
_mock("vncorenlp")
_mock("pandas")
_mock("aiohttp")

# numpy – prefer real if installed
try:
    import numpy as _np  # noqa: F401
except ImportError:
    _mock("numpy")

# ── aiofiles (async context manager) ─────────────────────────────────────
class _FakeAsyncFile:
    async def write(self, data): pass
    async def read(self): return b""
    async def __aenter__(self): return self
    async def __aexit__(self, *a): pass

class _FakeAsyncCtx:
    def __init__(self, *a, **kw): pass
    def __call__(self, *a, **kw): return self
    async def __aenter__(self): return _FakeAsyncFile()
    async def __aexit__(self, *a): pass

_aiofiles = types.ModuleType("aiofiles")
_aiofiles.open = _FakeAsyncCtx()
sys.modules["aiofiles"] = _aiofiles

# ── pymongo / motor / bson ────────────────────────────────────────────────
_pymongo_errors = types.ModuleType("pymongo.errors")
_pymongo_errors.ConnectionFailure = Exception
_pymongo_errors.ServerSelectionTimeoutError = Exception

_pymongo = types.ModuleType("pymongo")
_pymongo.errors = _pymongo_errors
sys.modules.setdefault("pymongo", _pymongo)
sys.modules.setdefault("pymongo.errors", _pymongo_errors)

_mock("motor")
_mock("motor.motor_asyncio")

try:
    from bson import ObjectId as _OID  # use real bson if installed
    _ = _OID  # noqa
except ImportError:
    _bson = types.ModuleType("bson")
    # ObjectId() with no args returns a unique string; with arg passes through
    _oid_counter = [0]
    def _fake_oid(x=None):
        if x is None:
            _oid_counter[0] += 1
            return f"fake_oid_{_oid_counter[0]}"
        return str(x)
    _bson.ObjectId = _fake_oid
    sys.modules.setdefault("bson", _bson)

# ── redis ─────────────────────────────────────────────────────────────────
_mock("redis")
_mock("redis.asyncio")

# ── app.config ────────────────────────────────────────────────────────────
# Must be patched BEFORE any app.* module is imported so that
# `from app.config import settings` works in all submodules.
_fake_settings = types.SimpleNamespace(
    APP_NAME="test-app",
    DEBUG=True,
    TEMP_PATH="/tmp",
    MONGODB_URI="mongodb://localhost:27017",
    MONGODB_DB_NAME="test_db",
    FACE_MODEL_PATH="/tmp",
    DLIB_PREDICTOR_PATH="/tmp",
    DLIB_RECOGNIZER_PATH="/tmp",
    NLP_MODEL_PATH="/tmp",
    SPEECH_MODEL_PATH="/tmp",
    EMBEDDING_MODEL_PATH="/tmp",
    EMBEDDING_CACHE_PATH="/tmp",
    DEFAULT_LANGUAGE="vi",
    MAX_CONVERSATION_HISTORY=10,
    CORS_ORIGINS=["*"],
)
_config_mod = types.ModuleType("app.config")
_config_mod.settings = _fake_settings
sys.modules["app.config"] = _config_mod

# ── app.utils.db_connector ───────────────────────────────────────────────
# Mock the whole module so tests can patch `mongo_client` freely.
_fake_mongo = MagicMock()
_fake_mongo.find_one = AsyncMock(return_value=None)
_fake_mongo.find_many = AsyncMock(return_value=[])
_fake_mongo.insert_one = AsyncMock(return_value=MagicMock())
_fake_mongo.update_one = AsyncMock(return_value=MagicMock())
_fake_mongo.delete_one = AsyncMock(return_value=MagicMock())
_fake_mongo.aggregate = AsyncMock(return_value=[])
_fake_mongo.get_collection = AsyncMock(return_value=MagicMock())

_db_mod = types.ModuleType("app.utils.db_connector")
_db_mod.mongo_client = _fake_mongo
sys.modules["app.utils.db_connector"] = _db_mod

# ── app.utils.error_handler ───────────────────────────────────────────────
_err_mod = types.ModuleType("app.utils.error_handler")
_err_mod.handle_exceptions = lambda f: f
sys.modules["app.utils.error_handler"] = _err_mod

# ── app.utils.logging ─────────────────────────────────────────────────────
sys.modules.setdefault("app.utils.logging", types.ModuleType("app.utils.logging"))

# ── app.models.* ──────────────────────────────────────────────────────────
# Stub each model class so API modules can instantiate them at import time
# without loading torch/dlib/etc.

class _FaceRecognitionModel:
    async def extract_face_encoding(self, path): return None
    async def compare_faces(self, a, b): return 0.0
    async def detect_faces(self, path): return []

_face_det_mod = types.ModuleType("app.models.face_detection")
_face_det_mod.FaceRecognitionModel = _FaceRecognitionModel
sys.modules["app.models.face_detection"] = _face_det_mod


class _ChatModel:
    async def generate_response(self, msg, **kw):
        return {"response": "", "intent_type": "unknown",
                "suggested_actions": [], "suggested_products": [], "suggested_recipes": []}
    async def get_suggestions(self, user_id=None, query=None, limit=5): return []

_chat_mod = types.ModuleType("app.models.chat_model")
_chat_mod.ChatModel = _ChatModel
sys.modules["app.models.chat_model"] = _chat_mod


class _RecommendationEngine:
    async def get_personalized_recommendations(self, *a, **kw): return []
    async def get_similar_products(self, *a, **kw): return []
    async def get_category_recommendations(self, *a, **kw): return []
    async def get_keyword_recommendations(self, *a, **kw): return []
    async def get_popular_products(self, **kw): return []
    async def update_all_product_embeddings(self): return 0
    async def update_user_embedding(self, uid): return False

_rec_mod = types.ModuleType("app.models.recommendation")
_rec_mod.RecommendationEngine = _RecommendationEngine
sys.modules["app.models.recommendation"] = _rec_mod


class _SpeechModel:
    async def recognize_speech(self, path, **kw): return {"text": "", "confidence": 0.0}
    async def text_to_speech(self, text, **kw): return b""
    async def list_voices(self): return []
    async def detect_language(self, path): return "vi"

_speech_mod = types.ModuleType("app.models.speech_recognition")
_speech_mod.SpeechModel = _SpeechModel
sys.modules["app.models.speech_recognition"] = _speech_mod


class _ProductEmbeddingModel:
    async def get_embedding(self, text): return []
    async def get_batch_embeddings(self, texts): return []
    def cosine_similarity(self, a, b): return 0.0

_emb_mod = types.ModuleType("app.models.product_embedding")
_emb_mod.ProductEmbeddingModel = _ProductEmbeddingModel
sys.modules["app.models.product_embedding"] = _emb_mod
