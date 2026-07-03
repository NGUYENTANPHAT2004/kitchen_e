import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi.testclient import TestClient
from fastapi import FastAPI

# ---------------------------------------------------------------------------
# App fixture
# ---------------------------------------------------------------------------

@pytest.fixture(scope="module")
def app():
    from app.api.chat import router
    _app = FastAPI()
    _app.include_router(router, prefix="/chat")
    return _app

@pytest.fixture(scope="module")
def client(app):
    return TestClient(app)

VALID_OID = "64b1234567890abcdef12345"
LOG_OID   = "64b1234567890abcdef99999"

# ---------------------------------------------------------------------------
# POST /chat/message
# ---------------------------------------------------------------------------

class TestChatMessage:
    def _mock_generate_response(self):
        return {
            "response": "Xin chào! Tôi có thể giúp gì cho bạn?",
            "intent_type": "greeting",
            "suggested_actions": [],
            "suggested_products": [],
            "suggested_recipes": [],
        }

    def test_send_message_success(self, client):
        with (
            patch("app.api.chat.mongo_client") as mock_db,
            patch("app.api.chat.chat_model") as mock_model,
        ):
            mock_db.find_one = AsyncMock(return_value=None)
            mock_db.find_many = AsyncMock(return_value=[])
            mock_db.insert_one = AsyncMock()
            mock_model.generate_response = AsyncMock(return_value=self._mock_generate_response())

            resp = client.post(
                "/chat/message",
                json={"message": "Xin chào", "language": "vi"},
            )
        assert resp.status_code == 200
        body = resp.json()
        assert "session_id" in body
        assert body["response"] == "Xin chào! Tôi có thể giúp gì cho bạn?"
        assert body["intent_type"] == "greeting"

    def test_send_message_with_user_id(self, client):
        with (
            patch("app.api.chat.mongo_client") as mock_db,
            patch("app.api.chat.chat_model") as mock_model,
        ):
            mock_db.find_one = AsyncMock(return_value=None)
            mock_db.find_many = AsyncMock(return_value=[])
            mock_db.insert_one = AsyncMock()
            mock_model.generate_response = AsyncMock(return_value=self._mock_generate_response())

            resp = client.post(
                "/chat/message",
                json={"message": "Gợi ý sản phẩm", "user_id": VALID_OID, "language": "vi"},
            )
        assert resp.status_code == 200
        assert "session_id" in resp.json()

    def test_send_message_reuses_session_id(self, client):
        with (
            patch("app.api.chat.mongo_client") as mock_db,
            patch("app.api.chat.chat_model") as mock_model,
        ):
            mock_db.find_one = AsyncMock(return_value={"sessionId": "sess-abc"})
            mock_db.find_many = AsyncMock(return_value=[
                {"query": "Xin chào", "response": "Chào!", "sessionId": "sess-abc"}
            ])
            mock_db.insert_one = AsyncMock()
            mock_model.generate_response = AsyncMock(return_value=self._mock_generate_response())

            resp = client.post(
                "/chat/message",
                json={"message": "Tôi muốn mua nồi", "session_id": "sess-abc", "language": "vi"},
            )
        assert resp.status_code == 200
        assert resp.json()["session_id"] == "sess-abc"

    def test_send_message_missing_message_field_returns_422(self, client):
        resp = client.post("/chat/message", json={"language": "vi"})
        assert resp.status_code == 422

    def test_chat_model_error_returns_500(self, client):
        with (
            patch("app.api.chat.mongo_client") as mock_db,
            patch("app.api.chat.chat_model") as mock_model,
        ):
            mock_db.find_one = AsyncMock(return_value=None)
            mock_db.find_many = AsyncMock(return_value=[])
            mock_model.generate_response = AsyncMock(side_effect=RuntimeError("model crash"))

            resp = client.post("/chat/message", json={"message": "test"})
        assert resp.status_code == 500


# ---------------------------------------------------------------------------
# GET /chat/history
# ---------------------------------------------------------------------------

class TestChatHistory:
    def _fake_log(self, idx=0):
        from datetime import datetime
        from bson import ObjectId
        return {
            "_id": ObjectId(),
            "sessionId": "sess-abc",
            "userId": ObjectId(VALID_OID),
            "query": f"query_{idx}",
            "response": f"response_{idx}",
            "intentType": "greeting",
            "querySource": "text",
            "responseTime": 100.0,
            "createdAt": datetime.utcnow(),
        }

    def test_get_history_by_session_id(self, client):
        with patch("app.api.chat.mongo_client") as mock_db:
            mock_db.find_many = AsyncMock(return_value=[self._fake_log(0), self._fake_log(1)])

            resp = client.get("/chat/history?session_id=sess-abc")
        assert resp.status_code == 200
        body = resp.json()
        assert body["count"] == 2
        assert len(body["history"]) == 2
        assert "query" in body["history"][0]

    def test_get_history_by_user_id(self, client):
        with patch("app.api.chat.mongo_client") as mock_db:
            mock_db.find_many = AsyncMock(return_value=[self._fake_log()])

            resp = client.get(f"/chat/history?user_id={VALID_OID}")
        assert resp.status_code == 200
        assert resp.json()["count"] == 1

    def test_get_history_no_params_returns_400(self, client):
        resp = client.get("/chat/history")
        assert resp.status_code == 400
        assert "session_id or user_id" in resp.json()["detail"]

    def test_get_history_empty_returns_empty_list(self, client):
        with patch("app.api.chat.mongo_client") as mock_db:
            mock_db.find_many = AsyncMock(return_value=[])

            resp = client.get("/chat/history?session_id=nonexistent")
        assert resp.status_code == 200
        assert resp.json()["count"] == 0


# ---------------------------------------------------------------------------
# POST /chat/feedback/{log_id}
# ---------------------------------------------------------------------------

class TestChatFeedback:
    def test_feedback_success(self, client):
        from datetime import datetime
        from bson import ObjectId
        fake_log = {
            "_id": ObjectId(LOG_OID),
            "sessionId": "sess-abc",
            "query": "test",
            "response": "ok",
            "intentType": "greeting",
            "querySource": "text",
            "responseTime": 50.0,
            "createdAt": datetime.utcnow(),
        }
        with patch("app.api.chat.mongo_client") as mock_db:
            mock_db.find_one = AsyncMock(return_value=fake_log)
            mock_db.update_one = AsyncMock()

            resp = client.post(
                f"/chat/feedback/{LOG_OID}",
                json={"is_helpful": True, "comments": "Rất hữu ích"},
            )
        assert resp.status_code == 200
        assert resp.json()["success"] is True

    def test_feedback_log_not_found_returns_404(self, client):
        with patch("app.api.chat.mongo_client") as mock_db:
            mock_db.find_one = AsyncMock(return_value=None)

            resp = client.post(
                f"/chat/feedback/{LOG_OID}",
                json={"is_helpful": False},
            )
        assert resp.status_code == 404
        assert "not found" in resp.json()["detail"].lower()

    def test_feedback_negative_is_stored(self, client):
        from datetime import datetime
        from bson import ObjectId
        fake_log = {"_id": ObjectId(LOG_OID), "sessionId": "s", "query": "q",
                    "response": "r", "intentType": "i", "querySource": "text",
                    "responseTime": 10, "createdAt": datetime.utcnow()}
        with patch("app.api.chat.mongo_client") as mock_db:
            mock_db.find_one = AsyncMock(return_value=fake_log)
            mock_db.update_one = AsyncMock()

            resp = client.post(
                f"/chat/feedback/{LOG_OID}",
                json={"is_helpful": False, "comments": "Không đúng"},
            )
        assert resp.status_code == 200
        assert resp.json()["success"] is True


# ---------------------------------------------------------------------------
# GET /chat/suggestions
# ---------------------------------------------------------------------------

class TestChatSuggestions:
    def test_get_suggestions_returns_list(self, client):
        with patch("app.api.chat.chat_model") as mock_model:
            mock_model.get_suggestions = AsyncMock(return_value=[
                "Gợi ý món ăn hôm nay",
                "Tìm nồi chiên không dầu",
                "Xem đơn hàng của tôi",
            ])
            resp = client.get("/chat/suggestions")
        assert resp.status_code == 200
        body = resp.json()
        assert "suggestions" in body
        assert len(body["suggestions"]) == 3

    def test_get_suggestions_with_query(self, client):
        with patch("app.api.chat.chat_model") as mock_model:
            mock_model.get_suggestions = AsyncMock(return_value=["Tìm nồi", "Xem công thức"])
            resp = client.get("/chat/suggestions?query=nồi&limit=2")
        assert resp.status_code == 200
        assert len(resp.json()["suggestions"]) == 2

    def test_get_suggestions_empty_when_model_returns_empty(self, client):
        with patch("app.api.chat.chat_model") as mock_model:
            mock_model.get_suggestions = AsyncMock(return_value=[])
            resp = client.get("/chat/suggestions")
        assert resp.status_code == 200
        assert resp.json()["suggestions"] == []
