import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import datetime
from fastapi.testclient import TestClient
from fastapi import FastAPI

# ---------------------------------------------------------------------------
# App fixture
# ---------------------------------------------------------------------------

@pytest.fixture(scope="module")
def app():
    from app.api.product_recommendation import router
    _app = FastAPI()
    _app.include_router(router, prefix="/recommendations")
    return _app

@pytest.fixture(scope="module")
def client(app):
    return TestClient(app)

VALID_OID   = "64b1234567890abcdef12345"
PRODUCT_OID = "64b1234567890abcdef67890"

def _fake_product(idx=0):
    return {
        "_id": PRODUCT_OID,
        "name": f"Sản phẩm {idx}",
        "price": 100_000 + idx * 10_000,
        "category": "nồi",
    }

# ---------------------------------------------------------------------------
# POST /recommendations/products  (multi-strategy)
# ---------------------------------------------------------------------------

class TestRecommendProducts:
    def test_personalized_recommendations(self, client):
        with patch("app.api.product_recommendation.recommendation_engine") as mock_eng:
            mock_eng.get_personalized_recommendations = AsyncMock(
                return_value=[_fake_product(i) for i in range(3)]
            )
            with patch("app.api.product_recommendation.mongo_client") as mock_db:
                mock_db.insert_one = AsyncMock()

                resp = client.post(
                    "/recommendations/products",
                    json={"user_id": VALID_OID, "limit": 3},
                )
        assert resp.status_code == 200
        body = resp.json()
        assert body["recommendation_type"] == "personalized"
        assert len(body["products"]) == 3

    def test_similar_product_recommendations(self, client):
        with patch("app.api.product_recommendation.recommendation_engine") as mock_eng:
            mock_eng.get_similar_products = AsyncMock(return_value=[_fake_product()])

            resp = client.post(
                "/recommendations/products",
                json={"product_id": PRODUCT_OID, "limit": 5},
            )
        assert resp.status_code == 200
        assert resp.json()["recommendation_type"] == "similar"

    def test_category_recommendations(self, client):
        with patch("app.api.product_recommendation.recommendation_engine") as mock_eng:
            mock_eng.get_category_recommendations = AsyncMock(return_value=[_fake_product()])

            resp = client.post(
                "/recommendations/products",
                json={"category_id": "cat-001", "limit": 5},
            )
        assert resp.status_code == 200
        assert resp.json()["recommendation_type"] == "category"

    def test_keyword_recommendations(self, client):
        with patch("app.api.product_recommendation.recommendation_engine") as mock_eng:
            mock_eng.get_keyword_recommendations = AsyncMock(return_value=[_fake_product()])

            resp = client.post(
                "/recommendations/products",
                json={"keywords": ["nồi", "chiên"], "limit": 5},
            )
        assert resp.status_code == 200
        assert resp.json()["recommendation_type"] == "keyword"

    def test_fallback_to_popular_when_no_params(self, client):
        with patch("app.api.product_recommendation.recommendation_engine") as mock_eng:
            mock_eng.get_popular_products = AsyncMock(return_value=[_fake_product()])

            resp = client.post("/recommendations/products", json={"limit": 5})
        assert resp.status_code == 200
        assert resp.json()["recommendation_type"] == "popular"

    def test_response_contains_timestamp(self, client):
        with patch("app.api.product_recommendation.recommendation_engine") as mock_eng:
            mock_eng.get_popular_products = AsyncMock(return_value=[])

            resp = client.post("/recommendations/products", json={})
        assert resp.status_code == 200
        assert "timestamp" in resp.json()


# ---------------------------------------------------------------------------
# GET /recommendations/products/popular
# ---------------------------------------------------------------------------

class TestPopularProducts:
    def test_returns_popular_list(self, client):
        with patch("app.api.product_recommendation.recommendation_engine") as mock_eng:
            mock_eng.get_popular_products = AsyncMock(
                return_value=[_fake_product(i) for i in range(5)]
            )
            resp = client.get("/recommendations/products/popular?limit=5")
        assert resp.status_code == 200
        assert len(resp.json()["products"]) == 5
        assert resp.json()["recommendation_type"] == "popular"

    def test_default_limit_applies(self, client):
        with patch("app.api.product_recommendation.recommendation_engine") as mock_eng:
            mock_eng.get_popular_products = AsyncMock(return_value=[_fake_product()])
            resp = client.get("/recommendations/products/popular")
        assert resp.status_code == 200

    def test_limit_out_of_range_returns_422(self, client):
        resp = client.get("/recommendations/products/popular?limit=0")
        assert resp.status_code == 422


# ---------------------------------------------------------------------------
# GET /recommendations/products/similar/{product_id}
# ---------------------------------------------------------------------------

class TestSimilarProducts:
    def test_returns_similar_list(self, client):
        with patch("app.api.product_recommendation.recommendation_engine") as mock_eng:
            mock_eng.get_similar_products = AsyncMock(return_value=[_fake_product()])
            resp = client.get(f"/recommendations/products/similar/{PRODUCT_OID}")
        assert resp.status_code == 200
        assert resp.json()["recommendation_type"] == "similar"

    def test_empty_when_no_similar(self, client):
        with patch("app.api.product_recommendation.recommendation_engine") as mock_eng:
            mock_eng.get_similar_products = AsyncMock(return_value=[])
            resp = client.get(f"/recommendations/products/similar/{PRODUCT_OID}")
        assert resp.status_code == 200
        assert resp.json()["products"] == []


# ---------------------------------------------------------------------------
# GET /recommendations/products/personalized/{user_id}
# ---------------------------------------------------------------------------

class TestPersonalizedRecommendations:
    def test_returns_personalized_list(self, client):
        with (
            patch("app.api.product_recommendation.recommendation_engine") as mock_eng,
            patch("app.api.product_recommendation.mongo_client") as mock_db,
        ):
            mock_eng.get_personalized_recommendations = AsyncMock(
                return_value=[_fake_product(i) for i in range(2)]
            )
            mock_db.insert_one = AsyncMock()

            resp = client.get(f"/recommendations/products/personalized/{VALID_OID}")
        assert resp.status_code == 200
        assert len(resp.json()["products"]) == 2
        assert resp.json()["recommendation_type"] == "personalized"


# ---------------------------------------------------------------------------
# POST /recommendations/feedback
# ---------------------------------------------------------------------------

class TestRecommendationFeedback:
    def test_feedback_success(self, client):
        with patch("app.api.product_recommendation.mongo_client") as mock_db:
            mock_db.find_one = AsyncMock(return_value={"_id": VALID_OID})
            mock_db.insert_one = AsyncMock()

            resp = client.post(
                "/recommendations/feedback",
                json={
                    "user_id": VALID_OID,
                    "product_id": PRODUCT_OID,
                    "recommendation_type": "personalized",
                    "action": "clicked",
                },
            )
        assert resp.status_code == 200
        assert resp.json()["success"] is True

    def test_feedback_user_not_found_returns_404(self, client):
        with patch("app.api.product_recommendation.mongo_client") as mock_db:
            mock_db.find_one = AsyncMock(return_value=None)

            resp = client.post(
                "/recommendations/feedback",
                json={
                    "user_id": VALID_OID,
                    "product_id": PRODUCT_OID,
                    "recommendation_type": "similar",
                    "action": "purchased",
                },
            )
        assert resp.status_code == 404

    def test_feedback_product_not_found_returns_404(self, client):
        with patch("app.api.product_recommendation.mongo_client") as mock_db:
            # user found, product not found
            mock_db.find_one = AsyncMock(side_effect=[{"_id": VALID_OID}, None])

            resp = client.post(
                "/recommendations/feedback",
                json={
                    "user_id": VALID_OID,
                    "product_id": PRODUCT_OID,
                    "recommendation_type": "popular",
                    "action": "ignored",
                },
            )
        assert resp.status_code == 404


# ---------------------------------------------------------------------------
# POST /recommendations/update-embeddings
# ---------------------------------------------------------------------------

class TestUpdateEmbeddings:
    def test_trigger_update_returns_success(self, client):
        with patch("app.api.product_recommendation.recommendation_engine") as mock_eng:
            mock_eng.update_all_product_embeddings = AsyncMock(return_value=42)

            resp = client.post("/recommendations/update-embeddings")
        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True
        assert "42" in body["message"]


# ---------------------------------------------------------------------------
# POST /recommendations/update-user-embeddings/{user_id}
# ---------------------------------------------------------------------------

class TestUpdateUserEmbeddings:
    def test_user_not_found_returns_404(self, client):
        with patch("app.api.product_recommendation.mongo_client") as mock_db:
            mock_db.find_one = AsyncMock(return_value=None)

            resp = client.post(f"/recommendations/update-user-embeddings/{VALID_OID}")
        assert resp.status_code == 404

    def test_update_success(self, client):
        with (
            patch("app.api.product_recommendation.mongo_client") as mock_db,
            patch("app.api.product_recommendation.recommendation_engine") as mock_eng,
        ):
            mock_db.find_one = AsyncMock(return_value={"_id": VALID_OID})
            mock_eng.update_user_embedding = AsyncMock(return_value=True)

            resp = client.post(f"/recommendations/update-user-embeddings/{VALID_OID}")
        assert resp.status_code == 200
        assert resp.json()["success"] is True

    def test_update_fails_due_to_insufficient_data(self, client):
        with (
            patch("app.api.product_recommendation.mongo_client") as mock_db,
            patch("app.api.product_recommendation.recommendation_engine") as mock_eng,
        ):
            mock_db.find_one = AsyncMock(return_value={"_id": VALID_OID})
            mock_eng.update_user_embedding = AsyncMock(return_value=False)

            resp = client.post(f"/recommendations/update-user-embeddings/{VALID_OID}")
        assert resp.status_code == 200
        assert resp.json()["success"] is False
