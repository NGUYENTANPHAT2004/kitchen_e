"""
MongoDB integration test scaffold (Task 9).

Unlike the rest of the suite — which mocks the database — these tests exercise
the real ``AsyncMongoClient`` against a live MongoDB. They are SKIPPED unless a
test MongoDB is reachable, so the default `pytest` run is unaffected.

To run them:
    set MONGODB_TEST_URI=mongodb://localhost:27017/kitchen_ecommerce_test   (Windows)
    export MONGODB_TEST_URI=mongodb://localhost:27017/kitchen_ecommerce_test (POSIX)
    pip install motor pymongo
    pytest tests/test_integration_mongo.py -v

Or spin up a throwaway container first:
    docker run -d -p 27017:27017 --name kitchen-mongo-test mongo:6

The tests import the *real* db_connector (bypassing the conftest stub) and use a
dedicated test database / collection that is dropped on teardown, so they never
touch production data.
"""
import os
import sys
import types
import importlib.util
import asyncio
from pathlib import Path

import pytest


PY_AI_ROOT = Path(__file__).resolve().parents[1]
DB_SRC = PY_AI_ROOT / "app" / "utils" / "db_connector.py"

MONGODB_TEST_URI = os.getenv("MONGODB_TEST_URI")

# Skip the entire module unless a test URI is configured AND the driver +
# server are actually available.
pytestmark = pytest.mark.skipif(
    not MONGODB_TEST_URI,
    reason="MONGODB_TEST_URI not set; skipping MongoDB integration tests",
)

TEST_COLLECTION = "_integration_test_products"


def _load_real_db_connector():
    """
    Load the genuine db_connector against the real motor/pymongo/bson, with a
    settings module pointed at MONGODB_TEST_URI.

    conftest.py stubs app.config / app.utils.db_connector with fakes; we build
    a clean settings module and load the real source under a fresh name so the
    integration test talks to a real server.
    """
    # Real driver must be importable.
    pytest.importorskip("motor")
    pytest.importorskip("pymongo")
    pytest.importorskip("bson")

    # Provide a real-ish settings module for the connector's import.
    saved_config = sys.modules.get("app.config")
    cfg = types.ModuleType("app.config")
    cfg.settings = types.SimpleNamespace(MONGODB_URI=MONGODB_TEST_URI)
    sys.modules["app.config"] = cfg

    spec = importlib.util.spec_from_file_location("real_db_connector", DB_SRC)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)

    return module, saved_config


@pytest.fixture
def mongo():
    """Provide a connected real client, dropping the test collection around each test."""
    module, saved_config = _load_real_db_connector()
    client = module.AsyncMongoClient()
    # Reset singleton state so each test connects fresh.
    client.initialized = False
    client.client = None
    client.db = None

    loop = asyncio.new_event_loop()

    async def _connect_or_skip():
        try:
            await client.connect()
        except Exception as e:
            pytest.skip(f"MongoDB not reachable at MONGODB_TEST_URI: {e}")

    loop.run_until_complete(_connect_or_skip())
    loop.run_until_complete(client.delete_many(TEST_COLLECTION, {}))

    try:
        yield client, loop
    finally:
        loop.run_until_complete(client.delete_many(TEST_COLLECTION, {}))
        loop.run_until_complete(client.close())
        if saved_config is not None:
            sys.modules["app.config"] = saved_config
        loop.close()


class TestMongoCrud:
    def test_insert_and_find_one(self, mongo):
        client, loop = mongo
        inserted_id = loop.run_until_complete(
            client.insert_one(TEST_COLLECTION, {"name": "Nồi inox", "price": 200000})
        )
        assert inserted_id

        doc = loop.run_until_complete(
            client.find_one(TEST_COLLECTION, {"name": "Nồi inox"})
        )
        assert doc is not None
        assert doc["price"] == 200000

    def test_find_many_with_sort_and_limit(self, mongo):
        client, loop = mongo
        loop.run_until_complete(client.insert_many(TEST_COLLECTION, [
            {"name": "A", "price": 300},
            {"name": "B", "price": 100},
            {"name": "C", "price": 200},
        ]))

        docs = loop.run_until_complete(
            client.find_many(TEST_COLLECTION, {}, sort=[("price", 1)], limit=2)
        )
        assert [d["price"] for d in docs] == [100, 200]

    def test_update_one(self, mongo):
        client, loop = mongo
        loop.run_until_complete(
            client.insert_one(TEST_COLLECTION, {"name": "X", "stock": 1})
        )
        modified = loop.run_until_complete(
            client.update_one(TEST_COLLECTION, {"name": "X"}, {"$set": {"stock": 5}})
        )
        assert modified == 1
        doc = loop.run_until_complete(client.find_one(TEST_COLLECTION, {"name": "X"}))
        assert doc["stock"] == 5

    def test_delete_and_count(self, mongo):
        client, loop = mongo
        loop.run_until_complete(client.insert_many(TEST_COLLECTION, [
            {"name": "D1"}, {"name": "D2"},
        ]))
        count = loop.run_until_complete(client.count_documents(TEST_COLLECTION, {}))
        assert count == 2

        deleted = loop.run_until_complete(
            client.delete_one(TEST_COLLECTION, {"name": "D1"})
        )
        assert deleted == 1
        count = loop.run_until_complete(client.count_documents(TEST_COLLECTION, {}))
        assert count == 1

    def test_aggregate(self, mongo):
        client, loop = mongo
        loop.run_until_complete(client.insert_many(TEST_COLLECTION, [
            {"category": "pan", "price": 100},
            {"category": "pan", "price": 200},
            {"category": "pot", "price": 300},
        ]))

        result = loop.run_until_complete(client.aggregate(TEST_COLLECTION, [
            {"$group": {"_id": "$category", "total": {"$sum": "$price"}}},
            {"$sort": {"_id": 1}},
        ]))
        totals = {r["_id"]: r["total"] for r in result}
        assert totals == {"pan": 300, "pot": 300}
