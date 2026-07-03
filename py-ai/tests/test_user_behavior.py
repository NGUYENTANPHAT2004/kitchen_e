"""
Tests for the user behavior analytics API (Task 6).

Covers activity logging, insights, segmentation, popular products, product
affinity, search trends, plus the pure helper functions.
"""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import datetime, timedelta
from fastapi.testclient import TestClient
from fastapi import FastAPI


@pytest.fixture(scope="module")
def app():
    from app.api.user_behavior import router
    _app = FastAPI()
    _app.include_router(router, prefix="/user-behavior")
    return _app


@pytest.fixture(scope="module")
def client(app):
    return TestClient(app)


VALID_OID = "64b1234567890abcdef12345"
PRODUCT_OID = "64b1234567890abcdef67890"


# ---------------------------------------------------------------------------
# POST /user-behavior/log-activity
# ---------------------------------------------------------------------------

class TestLogActivity:
    def test_log_success(self, client):
        with patch("app.api.user_behavior.mongo_client") as mock_db:
            mock_db.insert_one = AsyncMock()
            resp = client.post("/user-behavior/log-activity", json={
                "user_id": VALID_OID,
                "session_id": "sess-1",
                "activity_type": "product_view",
                "data": {"productId": PRODUCT_OID},
            })
        assert resp.status_code == 200
        assert resp.json()["success"] is True

    def test_missing_required_field_422(self, client):
        resp = client.post("/user-behavior/log-activity", json={
            "session_id": "sess-1",
            "activity_type": "product_view",
            "data": {},
        })  # missing user_id
        assert resp.status_code == 422


# ---------------------------------------------------------------------------
# GET /user-behavior/insights/{user_id}
# ---------------------------------------------------------------------------

class TestInsights:
    def test_returns_cached_recent_insights(self, client):
        recent = datetime.utcnow()
        cached = {
            "userId": VALID_OID,
            "insights": {"activity_summary": {"total_activities": 5}},
            "generatedAt": recent,
        }
        with patch("app.api.user_behavior.mongo_client") as mock_db:
            mock_db.find_one = AsyncMock(return_value=cached)
            resp = client.get(f"/user-behavior/insights/{VALID_OID}")
        assert resp.status_code == 200
        assert resp.json()["insights"]["activity_summary"]["total_activities"] == 5

    def test_generates_new_insights_when_none_cached(self, client):
        with patch("app.api.user_behavior.mongo_client") as mock_db:
            mock_db.find_one = AsyncMock(return_value=None)
            mock_db.insert_one = AsyncMock()
            with patch("app.api.user_behavior.generate_user_insights",
                       new=AsyncMock(return_value={"activity_summary": {"total_activities": 3}})):
                resp = client.get(f"/user-behavior/insights/{VALID_OID}?refresh=true")
        assert resp.status_code == 200
        assert resp.json()["insights"]["activity_summary"]["total_activities"] == 3

    def test_not_enough_data_404(self, client):
        with patch("app.api.user_behavior.mongo_client") as mock_db:
            mock_db.find_one = AsyncMock(return_value=None)
            with patch("app.api.user_behavior.generate_user_insights",
                       new=AsyncMock(return_value=None)):
                resp = client.get(f"/user-behavior/insights/{VALID_OID}?refresh=true")
        assert resp.status_code == 404


# ---------------------------------------------------------------------------
# GET /user-behavior/segments
# ---------------------------------------------------------------------------

class TestSegments:
    def test_returns_segments(self, client):
        fake_segments = [{"id": "loyal", "name": "Khách hàng trung thành", "user_count": 6}]
        with patch("app.api.user_behavior.generate_user_segments",
                   new=AsyncMock(return_value=fake_segments)):
            resp = client.get("/user-behavior/segments")
        assert resp.status_code == 200
        assert resp.json()["segments"][0]["id"] == "loyal"

    def test_no_data_404(self, client):
        with patch("app.api.user_behavior.generate_user_segments",
                   new=AsyncMock(return_value=None)):
            resp = client.get("/user-behavior/segments")
        assert resp.status_code == 404


# ---------------------------------------------------------------------------
# GET /user-behavior/popular-products
# ---------------------------------------------------------------------------

class TestPopularProducts:
    def test_aggregates_and_returns_products(self, client):
        product_views = [{"_id": PRODUCT_OID, "viewCount": 10, "uniqueUserCount": 4}]
        with patch("app.api.user_behavior.mongo_client") as mock_db:
            # aggregate called 3x: views, cart, purchases
            mock_db.aggregate = AsyncMock(side_effect=[product_views, [], []])
            mock_db.find_one = AsyncMock(return_value={
                "_id": PRODUCT_OID, "name": "Nồi inox", "basePrice": 200000, "images": ["i.jpg"]
            })
            resp = client.get("/user-behavior/popular-products?days=30&limit=10")
        assert resp.status_code == 200
        body = resp.json()
        assert body["days_analyzed"] == 30
        assert body["popular_products"][0]["name"] == "Nồi inox"

    def test_days_out_of_range_422(self, client):
        resp = client.get("/user-behavior/popular-products?days=0")
        assert resp.status_code == 422


# ---------------------------------------------------------------------------
# GET /user-behavior/product-affinity/{product_id}
# ---------------------------------------------------------------------------

class TestProductAffinity:
    def test_returns_related_products(self, client):
        with patch("app.api.user_behavior.mongo_client") as mock_db:
            mock_db.find_many = AsyncMock(side_effect=[
                [{"sessionId": "s1"}, {"sessionId": "s2"}],            # sessions with product
                [{"data": {"productId": "other-1"}, "sessionId": "s1"},
                 {"data": {"productId": "other-1"}, "sessionId": "s2"}],  # co-viewed
            ])
            mock_db.find_one = AsyncMock(return_value={
                "_id": "other-1", "name": "Chảo gang", "basePrice": 150000, "images": []
            })
            resp = client.get(f"/user-behavior/product-affinity/{PRODUCT_OID}")
        assert resp.status_code == 200
        body = resp.json()
        assert body["affinity_products"][0]["name"] == "Chảo gang"
        assert body["affinity_products"][0]["co_view_count"] == 2

    def test_no_sessions_404(self, client):
        with patch("app.api.user_behavior.mongo_client") as mock_db:
            mock_db.find_many = AsyncMock(return_value=[])
            resp = client.get(f"/user-behavior/product-affinity/{PRODUCT_OID}")
        assert resp.status_code == 404


# ---------------------------------------------------------------------------
# GET /user-behavior/search-trends
# ---------------------------------------------------------------------------

class TestSearchTrends:
    def test_returns_trends(self, client):
        logs = [
            {"data": {"query": "nồi inox"}, "userId": "u1", "timestamp": datetime.utcnow()},
            {"data": {"query": "nồi inox"}, "userId": "u2", "timestamp": datetime.utcnow()},
            {"data": {"query": "chảo"}, "userId": "u1", "timestamp": datetime.utcnow()},
        ]
        with patch("app.api.user_behavior.mongo_client") as mock_db:
            mock_db.find_many = AsyncMock(return_value=logs)
            resp = client.get("/user-behavior/search-trends")
        assert resp.status_code == 200
        body = resp.json()
        assert body["total_searches"] == 3
        # "nồi inox" searched twice -> top trend
        assert body["search_trends"][0]["term"] == "nồi inox"
        assert body["search_trends"][0]["count"] == 2
        assert body["search_trends"][0]["unique_users"] == 2

    def test_no_data_404(self, client):
        with patch("app.api.user_behavior.mongo_client") as mock_db:
            mock_db.find_many = AsyncMock(return_value=[])
            resp = client.get("/user-behavior/search-trends")
        assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Helper functions (pure)
# ---------------------------------------------------------------------------

class TestHelpers:
    def test_calculate_conversion_rate(self):
        from app.api.user_behavior import calculate_conversion_rate
        assert calculate_conversion_rate(0, 5) == 0
        assert calculate_conversion_rate(10, 2) == pytest.approx(0.2)

    def test_calculate_average_metrics_empty(self):
        from app.api.user_behavior import calculate_average_metrics
        assert calculate_average_metrics([]) == {}

    def test_calculate_average_metrics(self):
        from app.api.user_behavior import calculate_average_metrics
        users = [
            {"total_activities": 10, "purchase_count": 2, "avg_order_value": 100, "days_active": 5},
            {"total_activities": 20, "purchase_count": 0, "avg_order_value": 0, "days_active": 15},
        ]
        out = calculate_average_metrics(users)
        assert out["avg_activities"] == pytest.approx(15.0)
        assert out["avg_purchase_count"] == pytest.approx(1.0)
        # only the purchaser counts toward avg_order_value
        assert out["avg_order_value"] == pytest.approx(100.0)

    def test_format_insights(self):
        from app.api.user_behavior import format_insights
        now = datetime.utcnow()
        out = format_insights({
            "userId": VALID_OID,
            "insights": {"x": 1},
            "generatedAt": now,
        })
        assert out["user_id"] == str(VALID_OID)
        assert out["generated_at"] == now.isoformat()
