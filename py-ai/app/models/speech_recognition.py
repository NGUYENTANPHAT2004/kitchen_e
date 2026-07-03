import logging
import os
import asyncio
from typing import Dict, Any, List, Optional
from concurrent.futures import ThreadPoolExecutor

from app.config import settings

logger = logging.getLogger(__name__)

# Google Cloud clients are imported lazily so the module can be imported
# (and unit-tested) in environments where the libraries / credentials are
# not installed.  Import failures are downgraded to a clear runtime error
# only when an actual cloud call is attempted.
try:
    from google.cloud import speech as gcloud_speech
except Exception:  # pragma: no cover - depends on optional dependency
    gcloud_speech = None

try:
    from google.cloud import texttospeech as gcloud_tts
except Exception:  # pragma: no cover - depends on optional dependency
    gcloud_tts = None


# Map the short language codes used across the app to the BCP-47 codes that
# Google Cloud expects.
_LANGUAGE_CODE_MAP = {
    "vi": "vi-VN",
    "en": "en-US",
}

# A small thread pool to run the *blocking* Google Cloud SDK calls without
# blocking the asyncio event loop.
_executor = ThreadPoolExecutor(max_workers=4)


def _to_bcp47(language: str) -> str:
    """Normalise a short language code (e.g. ``vi``) to BCP-47 (``vi-VN``)."""
    if not language:
        return _LANGUAGE_CODE_MAP[settings.DEFAULT_LANGUAGE]
    # Already a full BCP-47 code such as "vi-VN"
    if "-" in language:
        return language
    return _LANGUAGE_CODE_MAP.get(language, language)


def _from_bcp47(language_code: str) -> str:
    """Reduce a BCP-47 code (``vi-VN``) back to the short form (``vi``)."""
    if not language_code:
        return settings.DEFAULT_LANGUAGE
    return language_code.split("-")[0].lower()


class SpeechModel:
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(SpeechModel, cls).__new__(cls)
            cls._instance.initialized = False
            cls._instance._speech_client = None
            cls._instance._tts_client = None
        return cls._instance

    async def initialize(self):
        """Initialize speech recognition / synthesis clients."""
        if self.initialized:
            return

        try:
            # Text-to-speech voices cache (used by list_voices when the cloud
            # voice listing is unavailable).
            self.voices = {
                "vi-VN": [
                    {"id": "vi-VN-Standard-A", "name": "Vietnamese Female (Standard)"},
                    {"id": "vi-VN-Standard-B", "name": "Vietnamese Male (Standard)"},
                ],
                "en-US": [
                    {"id": "en-US-Standard-A", "name": "English Female (Standard)"},
                    {"id": "en-US-Standard-B", "name": "English Male (Standard)"},
                ],
            }

            # Instantiate the cloud clients up-front when the libraries are
            # available.  This surfaces credential problems early rather than
            # on the first request.
            if gcloud_speech is not None:
                try:
                    self._speech_client = gcloud_speech.SpeechClient()
                except Exception as e:
                    logger.warning(
                        "Google Cloud Speech client unavailable (%s). "
                        "Speech-to-text will fail until credentials are configured.",
                        str(e),
                    )
                    self._speech_client = None

            if gcloud_tts is not None:
                try:
                    self._tts_client = gcloud_tts.TextToSpeechClient()
                except Exception as e:
                    logger.warning(
                        "Google Cloud TTS client unavailable (%s). "
                        "Text-to-speech will fail until credentials are configured.",
                        str(e),
                    )
                    self._tts_client = None

            self.initialized = True
            logger.info("Speech recognition model initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize speech recognition model: {str(e)}")
            raise

    # ------------------------------------------------------------------ #
    # Speech-to-Text
    # ------------------------------------------------------------------ #
    async def recognize_speech(
        self, audio_file_path: str, language: str = "vi"
    ) -> Optional[Dict[str, Any]]:
        """
        Recognize speech from an audio file using Google Cloud Speech-to-Text.

        Returns a dict with ``text``, ``confidence`` and ``language`` keys, or
        ``None`` when the file is missing or no speech could be transcribed.
        """
        await self.initialize()

        if not os.path.exists(audio_file_path):
            logger.error(f"Audio file does not exist: {audio_file_path}")
            return None

        if gcloud_speech is None or self._speech_client is None:
            raise RuntimeError(
                "Google Cloud Speech-to-Text is not configured. Install "
                "'google-cloud-speech' and set GOOGLE_APPLICATION_CREDENTIALS."
            )

        language_code = _to_bcp47(language)

        try:
            loop = asyncio.get_event_loop()
            result = await loop.run_in_executor(
                _executor,
                self._transcribe_sync,
                audio_file_path,
                language_code,
            )
            return result
        except Exception as e:
            logger.error(f"Error recognizing speech: {str(e)}")
            return None

    def _transcribe_sync(
        self, audio_file_path: str, language_code: str
    ) -> Optional[Dict[str, Any]]:
        """Blocking Speech-to-Text call. Runs inside the thread pool."""
        with open(audio_file_path, "rb") as audio_file:
            content = audio_file.read()

        audio = gcloud_speech.RecognitionAudio(content=content)
        config = gcloud_speech.RecognitionConfig(
            language_code=language_code,
            enable_automatic_punctuation=True,
            # Let Google detect the encoding/sample rate from the file header
            # so we support WAV, FLAC, MP3, etc. without manual configuration.
        )

        response = self._speech_client.recognize(config=config, audio=audio)

        if not response.results:
            logger.info("Speech-to-Text returned no results")
            return None

        # Take the top alternative of the first result.
        best = response.results[0].alternatives[0]

        return {
            "text": best.transcript,
            "confidence": float(best.confidence),
            "language": _from_bcp47(language_code),
        }

    # ------------------------------------------------------------------ #
    # Text-to-Speech
    # ------------------------------------------------------------------ #
    async def text_to_speech(
        self,
        text: str,
        voice_id: str = "vi-VN-Standard-A",
        language_code: str = "vi-VN",
    ) -> bytes:
        """
        Convert text to speech using Google Cloud Text-to-Speech.

        Returns MP3-encoded audio bytes.
        """
        await self.initialize()

        if not text:
            raise ValueError("text must not be empty")

        if gcloud_tts is None or self._tts_client is None:
            raise RuntimeError(
                "Google Cloud Text-to-Speech is not configured. Install "
                "'google-cloud-texttospeech' and set GOOGLE_APPLICATION_CREDENTIALS."
            )

        # The API expects a BCP-47 language code. Derive one from the voice id
        # when the caller passed a short code.
        bcp47 = _to_bcp47(language_code)

        try:
            loop = asyncio.get_event_loop()
            audio_content = await loop.run_in_executor(
                _executor,
                self._synthesize_sync,
                text,
                voice_id,
                bcp47,
            )
            return audio_content
        except Exception as e:
            logger.error(f"Error in text-to-speech conversion: {str(e)}")
            raise

    def _synthesize_sync(self, text: str, voice_id: str, language_code: str) -> bytes:
        """Blocking Text-to-Speech call. Runs inside the thread pool."""
        synthesis_input = gcloud_tts.SynthesisInput(text=text)

        voice = gcloud_tts.VoiceSelectionParams(
            language_code=language_code,
            name=voice_id,
        )

        audio_config = gcloud_tts.AudioConfig(
            audio_encoding=gcloud_tts.AudioEncoding.MP3,
        )

        response = self._tts_client.synthesize_speech(
            input=synthesis_input,
            voice=voice,
            audio_config=audio_config,
        )

        return response.audio_content

    # ------------------------------------------------------------------ #
    # Voices / language detection
    # ------------------------------------------------------------------ #
    async def list_voices(self, language_code: Optional[str] = None) -> List[Dict[str, str]]:
        """List available voices for text-to-speech."""
        await self.initialize()

        # Prefer the live voice list from the cloud when available.
        if gcloud_tts is not None and self._tts_client is not None:
            try:
                loop = asyncio.get_event_loop()
                voices = await loop.run_in_executor(
                    _executor, self._list_voices_sync, language_code
                )
                if voices:
                    return voices
            except Exception as e:
                logger.warning(f"Could not list cloud voices, using cache: {str(e)}")

        # Fall back to the static cache.
        if language_code:
            return self.voices.get(language_code, [])
        all_voices: List[Dict[str, str]] = []
        for lang_voices in self.voices.values():
            all_voices.extend(lang_voices)
        return all_voices

    def _list_voices_sync(self, language_code: Optional[str]) -> List[Dict[str, str]]:
        """Blocking voice-list call. Runs inside the thread pool."""
        request = {}
        if language_code:
            request["language_code"] = language_code

        response = self._tts_client.list_voices(**request)

        return [
            {
                "id": voice.name,
                "name": voice.name,
                "language_codes": list(voice.language_codes),
                "gender": gcloud_tts.SsmlVoiceGender(voice.ssml_gender).name,
            }
            for voice in response.voices
        ]

    async def detect_language(self, audio_file_path: str) -> str:
        """
        Detect the spoken language in an audio file.

        Uses Google Cloud Speech-to-Text alternative-language detection: it
        transcribes with a primary language plus a set of alternatives and
        returns the language code Google actually matched.
        """
        await self.initialize()

        if not os.path.exists(audio_file_path):
            logger.error(f"Audio file does not exist: {audio_file_path}")
            return settings.DEFAULT_LANGUAGE

        if gcloud_speech is None or self._speech_client is None:
            logger.warning(
                "Speech client unavailable; defaulting language to %s",
                settings.DEFAULT_LANGUAGE,
            )
            return settings.DEFAULT_LANGUAGE

        try:
            loop = asyncio.get_event_loop()
            return await loop.run_in_executor(
                _executor, self._detect_language_sync, audio_file_path
            )
        except Exception as e:
            logger.error(f"Error detecting language: {str(e)}")
            return settings.DEFAULT_LANGUAGE

    def _detect_language_sync(self, audio_file_path: str) -> str:
        """Blocking language-detection call. Runs inside the thread pool."""
        with open(audio_file_path, "rb") as audio_file:
            content = audio_file.read()

        audio = gcloud_speech.RecognitionAudio(content=content)
        primary = _LANGUAGE_CODE_MAP[settings.DEFAULT_LANGUAGE]
        alternates = [code for code in _LANGUAGE_CODE_MAP.values() if code != primary]

        config = gcloud_speech.RecognitionConfig(
            language_code=primary,
            alternative_language_codes=alternates,
            enable_automatic_punctuation=True,
        )

        response = self._speech_client.recognize(config=config, audio=audio)

        if not response.results:
            return settings.DEFAULT_LANGUAGE

        detected = response.results[0].language_code or primary
        return _from_bcp47(detected)
