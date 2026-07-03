from __future__ import annotations
import logging
import numpy as np
try:
    import torch
    from transformers import AutoTokenizer, AutoModel
    _TORCH_AVAILABLE = True
except ImportError:
    torch = None
    AutoTokenizer = None
    AutoModel = None
    _TORCH_AVAILABLE = False
import os
from typing import Dict, List, Any, Optional
import asyncio
from concurrent.futures import ThreadPoolExecutor
from app.config import settings

logger = logging.getLogger(__name__)

class ProductEmbeddingModel:
    _instance = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(ProductEmbeddingModel, cls).__new__(cls)
            cls._instance.initialized = False
            cls._instance.device = torch.device('cuda' if torch.cuda.is_available() else 'cpu') if _TORCH_AVAILABLE else 'cpu'
            cls._instance.embedding_dim = 768
        return cls._instance
    
    async def initialize(self):
        """Initialize the product embedding model"""
        if self.initialized:
            return

        try:
            if _TORCH_AVAILABLE and AutoTokenizer is not None:
                self.tokenizer = AutoTokenizer.from_pretrained(
                    settings.PHOBERT_MODEL_PATH,
                    use_auth_token=settings.HUGGINGFACE_API_KEY
                )
                self.model = AutoModel.from_pretrained(
                    settings.PHOBERT_MODEL_PATH,
                    use_auth_token=settings.HUGGINGFACE_API_KEY
                ).to(self.device)
            else:
                self.tokenizer = None
                self.model = None
                logger.warning("torch/transformers not available — embedding model using fallback")

            self.initialized = True
            logger.info("Product embedding model initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize product embedding model: {str(e)}")
            raise
    
    async def get_embedding(self, text: str) -> np.ndarray:
        """Get embedding for a text string"""
        await self.initialize()
        
        try:
            # Run inference in a separate thread to avoid blocking
            loop = asyncio.get_event_loop()
            with ThreadPoolExecutor() as pool:
                embedding = await loop.run_in_executor(pool, self._get_embedding_sync, text)
                
            return embedding
        except Exception as e:
            logger.error(f"Error generating embedding: {str(e)}")
            # Return a zero vector as fallback
            return np.zeros(self.embedding_dim)
    
    def _get_embedding_sync(self, text: str) -> np.ndarray:
        """Synchronous implementation of embedding generation"""
        # Preprocess text
        text = text.strip()
        
        if not text:
            return np.zeros(self.embedding_dim)
        
        # Truncate if too long
        max_length = 512
        if len(text) > max_length * 2:  # Rough character estimate
            text = text[:max_length * 2]
        
        # Tokenize
        inputs = self.tokenizer(
            text,
            return_tensors="pt",
            padding=True,
            truncation=True,
            max_length=max_length
        )
        
        # Move to device
        inputs = {k: v.to(self.device) for k, v in inputs.items()}
        
        # Get embeddings
        with torch.no_grad():
            outputs = self.model(**inputs)
        
        # Use mean pooling
        # Take average of all token embeddings for better representation
        attention_mask = inputs['attention_mask']
        token_embeddings = outputs.last_hidden_state
        
        # Multiply by attention mask to avoid considering padding tokens
        input_mask_expanded = attention_mask.unsqueeze(-1).expand(token_embeddings.size()).float()
        sum_embeddings = torch.sum(token_embeddings * input_mask_expanded, 1)
        sum_mask = torch.clamp(input_mask_expanded.sum(1), min=1e-9)
        
        # Normalize embeddings
        mean_embeddings = (sum_embeddings / sum_mask).cpu().numpy()
        
        return mean_embeddings[0]  # Return the first (and only) embedding
    
    async def get_batch_embeddings(self, texts: List[str]) -> List[np.ndarray]:
        """Get embeddings for a batch of texts"""
        await self.initialize()
        
        embeddings = []
        
        for text in texts:
            embedding = await self.get_embedding(text)
            embeddings.append(embedding)
        
        return embeddings
    
    async def get_similarity(self, text1: str, text2: str) -> float:
        """Calculate similarity between two texts"""
        await self.initialize()
        
        # Get embeddings
        embedding1 = await self.get_embedding(text1)
        embedding2 = await self.get_embedding(text2)
        
        # Calculate cosine similarity
        similarity = self._cosine_similarity(embedding1, embedding2)
        
        return similarity
    
    def _cosine_similarity(self, embedding1: np.ndarray, embedding2: np.ndarray) -> float:
        """Calculate cosine similarity between two embeddings"""
        # Ensure embeddings are normalized
        norm1 = np.linalg.norm(embedding1)
        norm2 = np.linalg.norm(embedding2)
        
        if norm1 == 0 or norm2 == 0:
            return 0.0
        
        embedding1 = embedding1 / norm1
        embedding2 = embedding2 / norm2
        
        # Calculate cosine similarity
        return float(np.dot(embedding1, embedding2))