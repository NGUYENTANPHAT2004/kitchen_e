"""
Tests for tasks 1-3 of the py-ai backlog:

  Task 1 — Google Cloud Speech-to-Text integration (recognize_speech)
  Task 2 — Google Cloud Text-to-Speech integration (text_to_speech)
  Task 3 — recommendation module import fix (RecommendationEngine lives in
           app.models.recommendation; recipe router lives in
           app.api.recipe_recommendation, with no circular self-import)

conftest.py stubs ``app.models.speech_recognition`` with a lightweight fake so
that other test modules don't need torch/google-cloud installed.  These tests
need the *real* implementation, so they import it directly from source and
inject fake ``google.cloud`` clients.
"""
import sys
import types
import importlib.util
from pathlib import Path
from unittest.mock import MagicMock

import pytest


# ---------------------------------------------------------------------------
# Helpers: load the real speech_recognition module with fake google.cloud SDKs
# ---------------------------------------------------------------------------

PY_AI_ROOT = Path(__file__).resolve().parents[1]
SPEECH_SRC = PY_AI_ROOT / "app" / "models" / "speech_recognition.py"


def _make_fake_speech_sdk():
    """Build a fake ``google.cloud.speech`` module."""
    mod = types.ModuleType("google.cloud.speech")

    class RecognitionAudio:
        def __init__(self, content=None):
            self.content = content

    class RecognitionConfig:
        def __init__(self, **kw):
            self.__dict__.update(kw)

    class SpeechClient:
        # Test code replaces ``recognize`` per-instance.
        def recognize(self, config=None, audio=None):  # pragma: no cover
            raise NotImplementedError

    mod.RecognitionAudio = RecognitionAudio
    mod.RecognitionConfig = RecognitionConfig
    mod.SpeechClient = SpeechClient
    return mod


def _make_fake_tts_sdk():
    """Build a fake ``google.cloud.texttospeech`` module."""
    mod = types.ModuleType("google.cloud.texttospeech")

    class SynthesisInput:
        def __init__(self, text=None):
            self.text = text

    class VoiceSelectionParams:
        def __init__(self, **kw):
            self.__dict__.update(kw)

    class AudioConfig:
        def __init__(self, **kw):
            self.__dict__.update(kw)

    class AudioEncoding:
        MP3 = "MP3"

    class SsmlVoiceGender:
        # Mimic the protobuf enum: callable by int, has .name
        def __init__(self, value):
            self._value = value

        @property
        def name(self):
            return {0: "NEUTRAL", 1: "MALE", 2: "FEMALE"}.get(self._value, "NEUTRAL")

    class TextToSpeechClient:
        def synthesize_speech(self, input=None, voice=None, audio_config=None):  # pragma: no cover
            raise NotImplementedError

        def list_voices(self, **kw):  # pragma: no cover
            raise NotImplementedError

    mod.SynthesisInput = SynthesisInput
    mod.VoiceSelectionParams = VoiceSelectionParams
    mod.AudioConfig = AudioConfig
    mod.AudioEncoding = AudioEncoding
    mod.SsmlVoiceGender = SsmlVoiceGender
    mod.TextToSpeechClient = TextToSpeechClient
    return mod


def _load_real_speech_module(fake_speech=None, fake_tts=None):
    """
    Import the genuine speech_recognition source under a unique module name,
    with ``google.cloud.speech`` / ``google.cloud.texttospeech`` resolving to
    the supplied fakes (or absent when None, to exercise the "not configured"
    path).
    """
    saved = {k: sys.modules.get(k) for k in
             ("google", "google.cloud", "google.cloud.speech",
              "google.cloud.texttospeech")}

    # Build a minimal google.cloud namespace package holding our fakes.
    google_pkg = types.ModuleType("google")
    cloud_pkg = types.ModuleType("google.cloud")
    google_pkg.cloud = cloud_pkg
    sys.modules["google"] = google_pkg
    sys.modules["google.cloud"] = cloud_pkg

    if fake_speech is not None:
        cloud_pkg.speech = fake_speech
        sys.modules["google.cloud.speech"] = fake_speech
    else:
        sys.modules.pop("google.cloud.speech", None)

    if fake_tts is not None:
        cloud_pkg.texttospeech = fake_tts
        sys.modules["google.cloud.texttospeech"] = fake_tts
    else:
        sys.modules.pop("google.cloud.texttospeech", None)

    # Reset the SpeechModel singleton so each load starts clean.
    spec = importlib.util.spec_from_file_location(
        "real_speech_recognition", SPEECH_SRC
    )
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)

    # Force a fresh singleton for the new module.
    module.SpeechModel._instance = None

    return module, saved


def _restore(saved):
    for k, v in saved.items():
        if v is None:
            sys.modules.pop(k, None)
        else:
            sys.modules[k] = v


# A wave/tmp audio file fixture
@pytest.fixture
def audio_file(tmp_path):
    p = tmp_path / "sample.wav"
    p.write_bytes(b"RIFF....WAVEfake-audio-bytes")
    return str(p)


# ---------------------------------------------------------------------------
# Task 1 — Speech-to-Text
# ---------------------------------------------------------------------------

class TestRecognizeSpeech:
    def test_transcribes_audio_via_cloud_client(self, audio_file):
        fake_speech = _make_fake_speech_sdk()
        module, saved = _load_real_speech_module(fake_speech=fake_speech)
        try:
            sm = module.SpeechModel()

            # Wire a fake recognition response.
            alt = MagicMock(transcript="xin chào", confidence=0.92)
            result_obj = MagicMock(alternatives=[alt])
            response = MagicMock(results=[result_obj])

            client = MagicMock()
            client.recognize.return_value = response
            sm._speech_client = client  # bypass real client construction
            sm.initialized = True
            sm.voices = {}

            import asyncio
            out = asyncio.get_event_loop().run_until_complete(
                sm.recognize_speech(audio_file, language="vi")
            )

            assert out["text"] == "xin chào"
            assert out["confidence"] == pytest.approx(0.92)
            assert out["language"] == "vi"
            # Verify it asked for the right BCP-47 language code.
            _, kwargs = client.recognize.call_args
            assert kwargs["config"].language_code == "vi-VN"
        finally:
            _restore(saved)

    def test_missing_file_returns_none(self):
        fake_speech = _make_fake_speech_sdk()
        module, saved = _load_real_speech_module(fake_speech=fake_speech)
        try:
            sm = module.SpeechModel()
            sm._speech_client = MagicMock()
            sm.initialized = True
            sm.voices = {}

            import asyncio
            out = asyncio.get_event_loop().run_until_complete(
                sm.recognize_speech("/no/such/file.wav")
            )
            assert out is None
        finally:
            _restore(saved)

    def test_no_results_returns_none(self, audio_file):
        fake_speech = _make_fake_speech_sdk()
        module, saved = _load_real_speech_module(fake_speech=fake_speech)
        try:
            sm = module.SpeechModel()
            client = MagicMock()
            client.recognize.return_value = MagicMock(results=[])
            sm._speech_client = client
            sm.initialized = True
            sm.voices = {}

            import asyncio
            out = asyncio.get_event_loop().run_until_complete(
                sm.recognize_speech(audio_file)
            )
            assert out is None
        finally:
            _restore(saved)

    def test_raises_when_cloud_not_configured(self, audio_file):
        # No fake SDK at all -> gcloud_speech is None -> RuntimeError.
        module, saved = _load_real_speech_module(fake_speech=None)
        try:
            sm = module.SpeechModel()
            sm.initialized = True
            sm.voices = {}
            sm._speech_client = None

            import asyncio
            with pytest.raises(RuntimeError):
                asyncio.get_event_loop().run_until_complete(
                    sm.recognize_speech(audio_file)
                )
        finally:
            _restore(saved)


# ---------------------------------------------------------------------------
# Task 2 — Text-to-Speech
# ---------------------------------------------------------------------------

class TestTextToSpeech:
    def test_synthesizes_audio_via_cloud_client(self):
        fake_tts = _make_fake_tts_sdk()
        module, saved = _load_real_speech_module(fake_tts=fake_tts)
        try:
            sm = module.SpeechModel()

            client = MagicMock()
            client.synthesize_speech.return_value = MagicMock(
                audio_content=b"ID3-fake-mp3-bytes"
            )
            sm._tts_client = client
            sm.initialized = True
            sm.voices = {}

            import asyncio
            out = asyncio.get_event_loop().run_until_complete(
                sm.text_to_speech("xin chào", voice_id="vi-VN-Standard-A",
                                  language_code="vi-VN")
            )

            assert out == b"ID3-fake-mp3-bytes"
            _, kwargs = client.synthesize_speech.call_args
            assert kwargs["voice"].language_code == "vi-VN"
            assert kwargs["voice"].name == "vi-VN-Standard-A"
            assert kwargs["audio_config"].audio_encoding == "MP3"
        finally:
            _restore(saved)

    def test_empty_text_raises(self):
        fake_tts = _make_fake_tts_sdk()
        module, saved = _load_real_speech_module(fake_tts=fake_tts)
        try:
            sm = module.SpeechModel()
            sm._tts_client = MagicMock()
            sm.initialized = True
            sm.voices = {}

            import asyncio
            with pytest.raises(ValueError):
                asyncio.get_event_loop().run_until_complete(
                    sm.text_to_speech("")
                )
        finally:
            _restore(saved)

    def test_raises_when_cloud_not_configured(self):
        module, saved = _load_real_speech_module(fake_tts=None)
        try:
            sm = module.SpeechModel()
            sm.initialized = True
            sm.voices = {}
            sm._tts_client = None

            import asyncio
            with pytest.raises(RuntimeError):
                asyncio.get_event_loop().run_until_complete(
                    sm.text_to_speech("hello")
                )
        finally:
            _restore(saved)


# ---------------------------------------------------------------------------
# Task 1/2 helper — language code mapping & detect_language fallback
# ---------------------------------------------------------------------------

class TestLanguageHelpers:
    def test_language_code_mapping(self):
        module, saved = _load_real_speech_module(fake_speech=_make_fake_speech_sdk())
        try:
            assert module._to_bcp47("vi") == "vi-VN"
            assert module._to_bcp47("en") == "en-US"
            assert module._to_bcp47("vi-VN") == "vi-VN"  # already BCP-47
            assert module._from_bcp47("vi-VN") == "vi"
            assert module._from_bcp47("en-US") == "en"
        finally:
            _restore(saved)

    def test_detect_language_returns_detected_code(self, audio_file):
        fake_speech = _make_fake_speech_sdk()
        module, saved = _load_real_speech_module(fake_speech=fake_speech)
        try:
            sm = module.SpeechModel()
            client = MagicMock()
            client.recognize.return_value = MagicMock(
                results=[MagicMock(language_code="en-US")]
            )
            sm._speech_client = client
            sm.initialized = True
            sm.voices = {}

            import asyncio
            out = asyncio.get_event_loop().run_until_complete(
                sm.detect_language(audio_file)
            )
            assert out == "en"
        finally:
            _restore(saved)

    def test_detect_language_falls_back_without_client(self, audio_file):
        module, saved = _load_real_speech_module(fake_speech=None)
        try:
            sm = module.SpeechModel()
            sm.initialized = True
            sm.voices = {}
            sm._speech_client = None

            import asyncio
            out = asyncio.get_event_loop().run_until_complete(
                sm.detect_language(audio_file)
            )
            assert out == "vi"  # DEFAULT_LANGUAGE
        finally:
            _restore(saved)


# ---------------------------------------------------------------------------
# Task 3 — recommendation module import fix
# ---------------------------------------------------------------------------

class TestRecommendationImportFix:
    """
    Validates the structural fix without importing the heavy modules (torch,
    sklearn). We assert on the *source* so the test is environment-independent.
    """

    MODELS_REC = PY_AI_ROOT / "app" / "models" / "recommendation.py"
    API_RECIPE = PY_AI_ROOT / "app" / "api" / "recipe_recommendation.py"
    API_PRODUCT = PY_AI_ROOT / "app" / "api" / "product_recommendation.py"

    def test_engine_module_defines_engine(self):
        src = self.MODELS_REC.read_text(encoding="utf-8")
        assert "class RecommendationEngine" in src

    def test_engine_module_has_no_self_import(self):
        src = self.MODELS_REC.read_text(encoding="utf-8")
        assert "from app.models.recommendation import RecommendationEngine" not in src

    def test_recipe_router_module_defines_router(self):
        src = self.API_RECIPE.read_text(encoding="utf-8")
        assert "router = APIRouter()" in src
        assert "class RecommendationEngine" not in src

    def test_recipe_router_has_no_dead_engine_import(self):
        src = self.API_RECIPE.read_text(encoding="utf-8")
        assert "from app.models.recommendation import RecommendationEngine" not in src
        assert "recommendation_engine = RecommendationEngine()" not in src

    def test_product_router_imports_engine_from_models(self):
        src = self.API_PRODUCT.read_text(encoding="utf-8")
        assert "from app.models.recommendation import RecommendationEngine" in src

    def test_recipe_router_imports_cleanly(self):
        """The recipe router must import without ImportError (conftest stubs deps)."""
        import importlib
        import app.api.recipe_recommendation as recipe_mod
        importlib.reload(recipe_mod)
        assert hasattr(recipe_mod, "router")
