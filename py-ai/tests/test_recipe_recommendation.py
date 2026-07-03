"""
Tests for the recipe recommendation API (Task 7) and the new semantic-search
ranking (Task 5).

The router lives in app.api.recipe_recommendation after the Task-3 fix. Heavy
dependencies (torch, transformers, mongo) are stubbed by conftest.py, and the
embedding model is imported lazily inside the router so these tests patch it
through app.api.recipe_recommendation directly.
"""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi.testclient import TestClient
from fastapi import FastAPI


@pytest.fixture(scope="module")
def app():
    from app.api.recipe_recommendation import router
    _app = FastAPI()
    _app.include_router(router, prefix="/recipes")
    return _app


@pytest.fixture(scope="module")
def client(app):
    return TestClient(app)


VALID_OID = "64b1234567890abcdef12345"
PRODUCT_OID = "64b1234567890abcdef67890"
RECIPE_OID = "64b1234567890abcdef55555"


def _fake_recipe(idx=0, title=None):
    return {
        "_id": RECIPE_OID,
        "title": title or f"Món ăn {idx}",
        "description": f"Mô tả món {idx}",
        "preparationTime": 20 + idx,
        "difficulty": "easy",
        "instructions": ["Bước 1"],
        "ingredients": [{"name": "trứng"}],
        "cuisineType": "Việt Nam",
        "avgRating": 4.5,
        "ratingCount": 10,
        "image": "img.jpg",
    }


# ---------------------------------------------------------------------------
# POST /recipes/recommend  (multi-strategy dispatch)
# ---------------------------------------------------------------------------

class TestRecommendRecipes:
    def test_product_based(self, client):
        with patch("app.api.recipe_recommendation.get_recipes_by_product",
                   new=AsyncMock(return_value=[_fake_recipe()])):
            resp = client.post("/recipes/recommend",
                               json={"product_id": PRODUCT_OID, "limit": 5})
        assert resp.status_code == 200
        assert resp.json()["recommendation_type"] == "product_based"

    def test_ingredient_based(self, client):
        with patch("app.api.recipe_recommendation.get_recipes_by_ingredients",
                   new=AsyncMock(return_value=[_fake_recipe()])):
            resp = client.post("/recipes/recommend",
                               json={"ingredients": ["trứng"], "limit": 5})
        assert resp.status_code == 200
        assert resp.json()["recommendation_type"] == "ingredient_based"

    def test_cuisine_based(self, client):
        with patch("app.api.recipe_recommendation.get_recipes_by_cuisine",
                   new=AsyncMock(return_value=[_fake_recipe()])):
            resp = client.post("/recipes/recommend",
                               json={"cuisine_type": "Việt Nam", "limit": 5})
        assert resp.status_code == 200
        assert resp.json()["recommendation_type"] == "cuisine_based"

    def test_semantic_query(self, client):
        with patch("app.api.recipe_recommendation.get_recipes_by_semantic_search",
                   new=AsyncMock(return_value=[_fake_recipe()])):
            resp = client.post("/recipes/recommend",
                               json={"query": "món gà chiên giòn", "limit": 5})
        assert resp.status_code == 200
        assert resp.json()["recommendation_type"] == "semantic"

    def test_fallback_popular(self, client):
        with patch("app.api.recipe_recommendation.get_popular_recipes",
                   new=AsyncMock(return_value=[_fake_recipe()])):
            resp = client.post("/recipes/recommend", json={"limit": 5})
        assert resp.status_code == 200
        assert resp.json()["recommendation_type"] == "popular"

    def test_personalized_logs_request(self, client):
        with patch("app.api.recipe_recommendation.get_personalized_recipes",
                   new=AsyncMock(return_value=[_fake_recipe()])):
            with patch("app.api.recipe_recommendation.mongo_client") as mock_db:
                mock_db.insert_one = AsyncMock()
                resp = client.post("/recipes/recommend",
                                   json={"user_id": VALID_OID, "limit": 5})
                assert resp.status_code == 200
                assert resp.json()["recommendation_type"] == "personalized"
                mock_db.insert_one.assert_awaited()  # logged


# ---------------------------------------------------------------------------
# GET /recipes/popular  &  /recipes/search
# ---------------------------------------------------------------------------

class TestPopularAndSearch:
    def test_popular_endpoint(self, client):
        with patch("app.api.recipe_recommendation.get_popular_recipes",
                   new=AsyncMock(return_value=[_fake_recipe(i) for i in range(3)])):
            resp = client.get("/recipes/popular?limit=3")
        assert resp.status_code == 200
        body = resp.json()
        assert body["recommendation_type"] == "popular"
        assert len(body["recipes"]) == 3

    def test_popular_limit_out_of_range_422(self, client):
        resp = client.get("/recipes/popular?limit=0")
        assert resp.status_code == 422

    def test_search_endpoint(self, client):
        with patch("app.api.recipe_recommendation.get_recipes_by_semantic_search",
                   new=AsyncMock(return_value=[_fake_recipe()])):
            resp = client.get("/recipes/search?query=gà&limit=5")
        assert resp.status_code == 200
        assert resp.json()["recommendation_type"] == "semantic"

    def test_search_requires_query(self, client):
        resp = client.get("/recipes/search")
        assert resp.status_code == 422


# ---------------------------------------------------------------------------
# POST /recipes/feedback
# ---------------------------------------------------------------------------

class TestRecipeFeedback:
    def test_feedback_success(self, client):
        with patch("app.api.recipe_recommendation.mongo_client") as mock_db:
            mock_db.find_one = AsyncMock(side_effect=[
                {"_id": VALID_OID},      # user exists
                {"_id": RECIPE_OID},     # recipe exists
            ])
            mock_db.insert_one = AsyncMock()
            resp = client.post("/recipes/feedback", json={
                "user_id": VALID_OID, "recipe_id": RECIPE_OID, "action": "favorited"
            })
        assert resp.status_code == 200
        assert resp.json()["success"] is True

    def test_feedback_user_not_found_404(self, client):
        with patch("app.api.recipe_recommendation.mongo_client") as mock_db:
            mock_db.find_one = AsyncMock(return_value=None)  # user missing
            resp = client.post("/recipes/feedback", json={
                "user_id": VALID_OID, "recipe_id": RECIPE_OID, "action": "favorited"
            })
        assert resp.status_code == 404

    def test_feedback_recipe_not_found_404(self, client):
        with patch("app.api.recipe_recommendation.mongo_client") as mock_db:
            mock_db.find_one = AsyncMock(side_effect=[
                {"_id": VALID_OID},  # user exists
                None,                # recipe missing
            ])
            resp = client.post("/recipes/feedback", json={
                "user_id": VALID_OID, "recipe_id": RECIPE_OID, "action": "favorited"
            })
        assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Task 5 — semantic search helper (unit-level)
# ---------------------------------------------------------------------------

class TestSemanticSearchHelper:
    @pytest.fixture(autouse=True)
    def _reset_embedding_cache(self):
        # Ensure each test starts with a clean lazy-model cache.
        import app.api.recipe_recommendation as mod
        mod._embedding_model = None
        mod._embedding_unavailable = False
        yield
        mod._embedding_model = None
        mod._embedding_unavailable = False

    def test_ranks_by_embedding_similarity(self):
        import asyncio
        import app.api.recipe_recommendation as mod

        recipes = [
            _fake_recipe(0, title="Gà chiên"),
            _fake_recipe(1, title="Canh chua"),
        ]

        # Fake embedding model: gà->[1,0], canh->[0,1], query gà->[1,0]
        fake_model = MagicMock()

        async def fake_get_embedding(text):
            t = text.lower()
            if "gà" in t or "chiên" in t:
                return [1.0, 0.0]
            if "canh" in t or "chua" in t:
                return [0.0, 1.0]
            return [1.0, 0.0]  # the query "gà"

        fake_model.get_embedding = fake_get_embedding
        fake_model._cosine_similarity = lambda a, b: float(
            sum(x * y for x, y in zip(a, b))
        )

        with patch("app.api.recipe_recommendation.mongo_client") as mock_db:
            mock_db.find_many = AsyncMock(return_value=recipes)
            with patch("app.api.recipe_recommendation._get_embedding_model",
                       new=AsyncMock(return_value=fake_model)):
                out = asyncio.get_event_loop().run_until_complete(
                    mod.get_recipes_by_semantic_search("gà", limit=5)
                )

        # "Gà chiên" should rank first with a high score.
        assert out[0]["title"] == "Gà chiên"
        assert out[0]["similarity_score"] == pytest.approx(1.0)

    def test_falls_back_to_text_search_without_model(self):
        import asyncio
        import app.api.recipe_recommendation as mod

        recipes = [
            _fake_recipe(0, title="Gà chiên giòn"),
            _fake_recipe(1, title="Canh chua cá"),
        ]

        with patch("app.api.recipe_recommendation.mongo_client") as mock_db:
            mock_db.find_many = AsyncMock(return_value=recipes)
            with patch("app.api.recipe_recommendation._get_embedding_model",
                       new=AsyncMock(return_value=None)):
                out = asyncio.get_event_loop().run_until_complete(
                    mod.get_recipes_by_semantic_search("gà", limit=5)
                )

        # Fallback substring match should find the "Gà" recipe only.
        titles = [r["title"] for r in out]
        assert "Gà chiên giòn" in titles
        assert "Canh chua cá" not in titles

    def test_empty_when_no_candidate_recipes(self):
        import asyncio
        import app.api.recipe_recommendation as mod

        with patch("app.api.recipe_recommendation.mongo_client") as mock_db:
            mock_db.find_many = AsyncMock(return_value=[])
            out = asyncio.get_event_loop().run_until_complete(
                mod.get_recipes_by_semantic_search("bất kỳ", limit=5)
            )
        assert out == []
