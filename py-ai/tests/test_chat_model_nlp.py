"""
Tests for chat_model enhancements:

  Task 4 — entity extraction (NER + domain dictionary + regex)
  Task 8 — conversation context window trimming

conftest.py stubs ``app.models.chat_model`` with a lightweight fake for the
chat API tests, so these tests load the *real* implementation directly from
source (with transformers/torch already stubbed by conftest).
"""
import sys
import types
import importlib.util
import asyncio
from pathlib import Path

import pytest


PY_AI_ROOT = Path(__file__).resolve().parents[1]
CHAT_SRC = PY_AI_ROOT / "app" / "models" / "chat_model.py"


def _load_real_chat_model(with_ner=False):
    """
    Load the genuine chat_model source under a unique module name.

    When with_ner is True, inject a fake ``underthesea.ner`` so the NER branch
    is exercised; otherwise leave it absent to test the dictionary/regex-only
    path.
    """
    saved_uts = sys.modules.get("underthesea")

    if with_ner:
        uts = types.ModuleType("underthesea")

        def fake_ner(text):
            # Return BIO-tagged tuples. Tag "Hà Nội" as a LOCATION.
            tokens = []
            for word in text.split():
                if word == "Hà":
                    tokens.append((word, "Np", "B-NP", "B-LOC"))
                elif word == "Nội":
                    tokens.append((word, "Np", "I-NP", "I-LOC"))
                else:
                    tokens.append((word, "N", "B-NP", "O"))
            return tokens

        uts.ner = fake_ner
        sys.modules["underthesea"] = uts
    else:
        sys.modules.pop("underthesea", None)

    spec = importlib.util.spec_from_file_location("real_chat_model", CHAT_SRC)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    module.ChatModel._instance = None

    return module, saved_uts


def _restore(saved_uts):
    if saved_uts is None:
        sys.modules.pop("underthesea", None)
    else:
        sys.modules["underthesea"] = saved_uts


def _make_model(module):
    """Instantiate a ChatModel with initialize() short-circuited."""
    sm = module.ChatModel()
    sm.initialized = True

    async def _noop_init():
        return None

    sm.initialize = _noop_init
    return sm


# ---------------------------------------------------------------------------
# Task 4 — entity extraction
# ---------------------------------------------------------------------------

class TestExtractEntities:
    def test_extracts_product_and_material(self):
        module, saved = _load_real_chat_model(with_ner=False)
        try:
            sm = _make_model(module)
            out = asyncio.get_event_loop().run_until_complete(
                sm.extract_entities("Tôi muốn mua nồi inox chống dính")
            )
            assert "nồi" in out["products"]
            assert "inox" in out["materials"]
            assert "chống dính" in out["materials"]
        finally:
            _restore(saved)

    def test_extracts_quantity(self):
        module, saved = _load_real_chat_model(with_ner=False)
        try:
            sm = _make_model(module)
            out = asyncio.get_event_loop().run_until_complete(
                sm.extract_entities("Cho tôi 2 cái chảo")
            )
            assert {"value": 2, "unit": "cái"} in out["quantities"]
            assert "chảo" in out["products"]
        finally:
            _restore(saved)

    def test_extracts_price_with_units(self):
        module, saved = _load_real_chat_model(with_ner=False)
        try:
            sm = _make_model(module)
            out = asyncio.get_event_loop().run_until_complete(
                sm.extract_entities("Nồi giá khoảng 200k đến 1 triệu")
            )
            amounts = sorted(p["amount"] for p in out["prices"])
            assert 200_000 in amounts
            assert 1_000_000 in amounts
        finally:
            _restore(saved)

    def test_dedupes_products(self):
        module, saved = _load_real_chat_model(with_ner=False)
        try:
            sm = _make_model(module)
            out = asyncio.get_event_loop().run_until_complete(
                sm.extract_entities("nồi nồi nồi cơm")
            )
            # "nồi" should appear once despite repetition.
            assert out["products"].count("nồi") == 1
        finally:
            _restore(saved)

    def test_empty_when_no_entities(self):
        module, saved = _load_real_chat_model(with_ner=False)
        try:
            sm = _make_model(module)
            out = asyncio.get_event_loop().run_until_complete(
                sm.extract_entities("xin chào")
            )
            assert out["products"] == []
            assert out["materials"] == []
            assert out["quantities"] == []
            assert out["prices"] == []
        finally:
            _restore(saved)

    def test_ner_backend_extracts_location(self):
        module, saved = _load_real_chat_model(with_ner=True)
        try:
            sm = _make_model(module)
            out = asyncio.get_event_loop().run_until_complete(
                sm.extract_entities("Giao hàng tới Hà Nội")
            )
            ner_texts = [e["text"] for e in out["ner"]]
            assert "Hà Nội" in ner_texts
            loc = next(e for e in out["ner"] if e["text"] == "Hà Nội")
            assert loc["label"] == "LOC"
        finally:
            _restore(saved)

    def test_works_without_ner_backend(self):
        # No underthesea -> ner list empty, but dictionary still works.
        module, saved = _load_real_chat_model(with_ner=False)
        try:
            assert module._uts_ner is None
            sm = _make_model(module)
            out = asyncio.get_event_loop().run_until_complete(
                sm.extract_entities("mua dao")
            )
            assert out["ner"] == []
            assert "dao" in out["products"]
        finally:
            _restore(saved)


# ---------------------------------------------------------------------------
# Task 8 — conversation context window trimming
# ---------------------------------------------------------------------------

class TestTrimHistory:
    def test_keeps_all_when_under_limit(self):
        module, saved = _load_real_chat_model(with_ner=False)
        try:
            sm = _make_model(module)
            history = [{"role": "user", "content": f"m{i}"} for i in range(4)]
            assert sm._trim_history(history) == history
        finally:
            _restore(saved)

    def test_trims_to_window_keeping_latest(self):
        module, saved = _load_real_chat_model(with_ner=False)
        try:
            sm = _make_model(module)
            # settings.MAX_CONVERSATION_HISTORY=10 turns -> 20 messages kept.
            history = [{"role": "user", "content": f"m{i}"} for i in range(50)]
            trimmed = sm._trim_history(history)
            assert len(trimmed) == 20
            # Latest messages preserved.
            assert trimmed[-1]["content"] == "m49"
            assert trimmed[0]["content"] == "m30"
        finally:
            _restore(saved)


# ---------------------------------------------------------------------------
# generate_response now includes entities + trims history
# ---------------------------------------------------------------------------

class TestGenerateResponseEntities:
    def test_response_includes_entities(self):
        module, saved = _load_real_chat_model(with_ner=False)
        try:
            sm = _make_model(module)

            # Stub the pieces generate_response calls so we isolate entities.
            async def _intent(text):
                return "product_inquiry"
            sm.detect_intent = _intent

            async def _resp(text, intent, user_id=None):
                return "ok"
            sm._generate_intent_response = _resp

            async def _actions(intent):
                return []
            sm._get_suggested_actions = _actions

            async def _prods(text, user_id=None):
                return []
            sm.get_product_recommendations = _prods

            out = asyncio.get_event_loop().run_until_complete(
                sm.generate_response("mua nồi inox")
            )
            assert "entities" in out
            assert "nồi" in out["entities"]["products"]
            assert "inox" in out["entities"]["materials"]
        finally:
            _restore(saved)
