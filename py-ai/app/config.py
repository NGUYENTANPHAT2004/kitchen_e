import os
from pydantic_settings import BaseSettings
from functools import lru_cache
from typing import List, Optional

class Settings(BaseSettings):
    # App Settings
    APP_NAME: str = "Kitchen E-commerce AI Service"
    DEBUG: bool = os.getenv("DEBUG", "False").lower() == "true"
    PORT: int = int(os.getenv("PORT", 8000))
    
    # CORS Settings
    NODE_BACKEND_URL: str = os.getenv("NODE_BACKEND_URL", "http://localhost:5000")
    
    # MongoDB Settings
    MONGODB_URI: str = os.getenv("MONGODB_URI", "mongodb://localhost:27017/kitchen_ecommerce")
    
    # AI Model Paths
    MODEL_PATH: str = os.getenv("MODEL_PATH", "data/models")
    FACE_DETECTION_MODEL_PATH: str = os.path.join(MODEL_PATH, "face_detection")
    NLP_MODEL_PATH: str = os.path.join(MODEL_PATH, "nlp")
    SPEECH_MODEL_PATH: str = os.path.join(MODEL_PATH, "speech")
    
    # NLP Settings
    PHOBERT_MODEL_PATH: str = os.path.join(NLP_MODEL_PATH, "phobert-base")
    EMBEDDING_MODEL_PATH: str = os.path.join(NLP_MODEL_PATH, "embedding")
    
    # Face Recognition Settings
    FACE_LANDMARK_MODEL: str = os.path.join(FACE_DETECTION_MODEL_PATH, "shape_predictor_68_face_landmarks.dat")
    FACE_RECOGNITION_MODEL: str = os.path.join(FACE_DETECTION_MODEL_PATH, "dlib_face_recognition_resnet_model_v1.dat")
    
    # Storage Paths
    EMBEDDINGS_PATH: str = os.getenv("EMBEDDINGS_PATH", "data/embeddings")
    TEMP_PATH: str = os.getenv("TEMP_PATH", "data/temp")
    
    # API Keys
    OPENAI_API_KEY: Optional[str] = os.getenv("OPENAI_API_KEY")
    HUGGINGFACE_API_KEY: Optional[str] = os.getenv("HUGGINGFACE_API_KEY")
    
    # Security
    SECRET_KEY: str = os.getenv("SECRET_KEY", "NzNkMjY0NjMtMmU4NS00OWRlLTk3OWItOTM5OTRjZjFlN2Iw")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    
    # Caching
    REDIS_URL: Optional[str] = os.getenv("REDIS_URL")
    ENABLE_CACHE: bool = os.getenv("ENABLE_CACHE", "True").lower() == "true"
    
    # Recommendation Settings
    RECOMMENDATION_TOP_K: int = int(os.getenv("RECOMMENDATION_TOP_K", 10))
    USER_HISTORY_LIMIT: int = int(os.getenv("USER_HISTORY_LIMIT", 20))
    
    # AI Assistant Settings
    MAX_CONVERSATION_HISTORY: int = int(os.getenv("MAX_CONVERSATION_HISTORY", 10))
    DEFAULT_LANGUAGE: str = os.getenv("DEFAULT_LANGUAGE", "vi")
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"

@lru_cache()
def get_settings():
    return Settings()

settings = get_settings()

# Ensure directories exist
os.makedirs(settings.FACE_DETECTION_MODEL_PATH, exist_ok=True)
os.makedirs(settings.NLP_MODEL_PATH, exist_ok=True)
os.makedirs(settings.SPEECH_MODEL_PATH, exist_ok=True)
os.makedirs(settings.EMBEDDINGS_PATH, exist_ok=True)
os.makedirs(settings.TEMP_PATH, exist_ok=True)