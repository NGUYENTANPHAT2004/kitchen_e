from __future__ import annotations
import logging
import numpy as np
import os
import json
import pickle
from typing import List, Dict, Any, Optional, Tuple
import asyncio
from datetime import datetime, timedelta
try:
    import torch
    _TORCH_AVAILABLE = True
except ImportError:
    torch = None
    _TORCH_AVAILABLE = False
from sklearn.metrics.pairwise import cosine_similarity
from app.config import settings
from app.models.product_embedding import ProductEmbeddingModel
from app.utils.db_connector import mongo_client
from bson import ObjectId

logger = logging.getLogger(__name__)

class RecommendationEngine:
    _instance = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(RecommendationEngine, cls).__new__(cls)
            cls._instance.initialized = False
            cls._instance.device = torch.device('cuda' if torch.cuda.is_available() else 'cpu') if _TORCH_AVAILABLE else 'cpu'
        return cls._instance
    
    async def initialize(self):
        """Initialize the recommendation engine"""
        if self.initialized:
            return

        try:
            # Initialize the product embedding model
            self.embedding_model = ProductEmbeddingModel()
            await self.embedding_model.initialize()

            # Load cached embeddings if available
            embeddings_path = os.path.join(settings.EMBEDDINGS_PATH, "product_embeddings.pkl")

            if os.path.exists(embeddings_path):
                with open(embeddings_path, "rb") as f:
                    self.product_embeddings = pickle.load(f)
                logger.info(f"Loaded {len(self.product_embeddings)} product embeddings from cache")
            else:
                self.product_embeddings = {}
                logger.info("No cached product embeddings found, starting with empty embeddings")

            # Load user embeddings if available
            user_embeddings_path = os.path.join(settings.EMBEDDINGS_PATH, "user_embeddings.pkl")

            if os.path.exists(user_embeddings_path):
                with open(user_embeddings_path, "rb") as f:
                    self.user_embeddings = pickle.load(f)
                logger.info(f"Loaded {len(self.user_embeddings)} user embeddings from cache")
            else:
                self.user_embeddings = {}
                logger.info("No cached user embeddings found, starting with empty embeddings")

            self.product_info_cache = {}

            # Only check embeddings if the ML model is actually available
            if _TORCH_AVAILABLE:
                await self._check_and_update_embeddings()

            self.initialized = True
            logger.info("Recommendation engine initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize recommendation engine: {str(e)}")
            raise
    
    async def _check_and_update_embeddings(self):
        """Check if embeddings need to be updated and update them if necessary"""
        # Check when embeddings were last updated
        last_update_path = os.path.join(settings.EMBEDDINGS_PATH, "last_update.json")
        
        if os.path.exists(last_update_path):
            with open(last_update_path, "r") as f:
                last_update = json.load(f)
                last_update_time = datetime.fromisoformat(last_update.get("timestamp", "2000-01-01T00:00:00"))
        else:
            last_update_time = datetime(2000, 1, 1)  # Very old date to force update
        
        # Check if it's been more than a day since last update
        if datetime.now() - last_update_time > timedelta(days=1):
            logger.info("Embeddings need to be updated")
            
            # Update product embeddings
            await self.update_all_product_embeddings()
            
            # Update last update time
            with open(last_update_path, "w") as f:
                json.dump({"timestamp": datetime.now().isoformat()}, f)
    
    async def update_all_product_embeddings(self) -> int:
        """Update embeddings for all products"""
        if not self.initialized:
            await self.initialize()
            return 0  # initialize() already calls _check_and_update_embeddings when torch is available
        
        try:
            # Get all active products
            products = await mongo_client.find_many(
                "products",
                {"isDeleted": {"$ne": True}}
            )
            
            logger.info(f"Updating embeddings for {len(products)} products")
            
            # Process products in batches
            batch_size = 50
            updated_count = 0
            
            for i in range(0, len(products), batch_size):
                batch = products[i:i+batch_size]
                
                for product in batch:
                    prod_id = str(product["_id"])
                    
                    # Get product text for embedding
                    product_text = await self._get_product_text(product)
                    
                    # Generate embedding
                    embedding = await self.embedding_model.get_embedding(product_text)
                    
                    # Store embedding
                    self.product_embeddings[prod_id] = embedding
                    
                    # Cache product info
                    self.product_info_cache[prod_id] = self._extract_product_info(product)
                    
                    updated_count += 1
                
                logger.info(f"Updated embeddings for {updated_count}/{len(products)} products")
            
            # Save embeddings to disk
            os.makedirs(settings.EMBEDDINGS_PATH, exist_ok=True)
            with open(os.path.join(settings.EMBEDDINGS_PATH, "product_embeddings.pkl"), "wb") as f:
                pickle.dump(self.product_embeddings, f)
            
            logger.info(f"Successfully updated and saved embeddings for {updated_count} products")
            return updated_count
        
        except Exception as e:
            logger.error(f"Error updating product embeddings: {str(e)}")
            raise
    
    async def update_user_embedding(self, user_id: str) -> bool:
        """Update embedding for a specific user"""
        await self.initialize()
        
        try:
            # Get user's browsing and purchase history
            user_history = await self._get_user_history(user_id)
            
            if not user_history:
                logger.warning(f"No history found for user {user_id}")
                return False
            
            # Extract product IDs from history
            product_ids = [item["productId"] for item in user_history]
            
            # Ensure all products have embeddings
            for prod_id in product_ids:
                if prod_id not in self.product_embeddings:
                    # Get product from database
                    product = await mongo_client.find_one(
                        "products",
                        {"_id": ObjectId(prod_id)}
                    )
                    
                    if product:
                        # Generate embedding
                        product_text = await self._get_product_text(product)
                        embedding = await self.embedding_model.get_embedding(product_text)
                        
                        # Store embedding
                        self.product_embeddings[prod_id] = embedding
                        
                        # Cache product info
                        self.product_info_cache[prod_id] = self._extract_product_info(product)
            
            # Generate user embedding based on history
            # Use a weighted average of product embeddings based on recency and interaction type
            user_embedding = np.zeros(self.embedding_model.embedding_dim)
            total_weight = 0
            
            for item in user_history:
                prod_id = item["productId"]
                
                if prod_id in self.product_embeddings:
                    # Calculate weight based on interaction type and recency
                    weight = self._calculate_interaction_weight(item)
                    
                    # Add weighted embedding
                    user_embedding += weight * self.product_embeddings[prod_id]
                    total_weight += weight
            
            if total_weight > 0:
                # Normalize embedding
                user_embedding /= total_weight
                
                # Store user embedding
                self.user_embeddings[user_id] = user_embedding
                
                # Save user embeddings to disk
                os.makedirs(settings.EMBEDDINGS_PATH, exist_ok=True)
                with open(os.path.join(settings.EMBEDDINGS_PATH, "user_embeddings.pkl"), "wb") as f:
                    pickle.dump(self.user_embeddings, f)
                
                logger.info(f"Successfully updated and saved embedding for user {user_id}")
                return True
            else:
                logger.warning(f"Could not generate embedding for user {user_id} due to missing product embeddings")
                return False
        
        except Exception as e:
            logger.error(f"Error updating user embedding: {str(e)}")
            return False
    
    def _calculate_interaction_weight(self, interaction: Dict[str, Any]) -> float:
        """Calculate weight for a user-product interaction"""
        # Base weights by interaction type
        type_weights = {
            "view": 1.0,
            "add_to_cart": 2.0,
            "add_to_wishlist": 2.5,
            "purchase": 5.0
        }
        
        # Get base weight
        base_weight = type_weights.get(interaction["type"], 1.0)
        
        # Apply recency weight
        days_ago = (datetime.now() - interaction["timestamp"]).days
        recency_weight = max(0.5, min(1.0, 1.0 - (days_ago / 30)))  # Decay over 30 days
        
        return base_weight * recency_weight
    
    async def _get_product_text(self, product: Dict[str, Any]) -> str:
        """Generate text representation of a product for embedding"""
        # Combine product information into a single text string
        text_parts = []
        
        # Add product name
        if "name" in product:
            text_parts.append(f"Tên sản phẩm: {product['name']}")
        
        # Add product description
        if "description" in product:
            text_parts.append(f"Mô tả: {product['description']}")
        
        # Add category information
        if "categoryId" in product:
            # Get category name
            category = await mongo_client.find_one(
                "categories",
                {"_id": product["categoryId"]}
            )
            
            if category and "name" in category:
                text_parts.append(f"Danh mục: {category['name']}")
        
        # Add material information
        variant_info = ""
        if "productVariants" in product and product["productVariants"]:
            variant = product["productVariants"][0]  # Use first variant
            
            if "material" in variant:
                variant_info += f"Chất liệu: {variant['material']}. "
            
            if "color" in variant:
                variant_info += f"Màu sắc: {variant['color']}. "
            
            if "size" in variant:
                variant_info += f"Kích thước: {variant['size']}. "
        
        if variant_info:
            text_parts.append(variant_info)
        
        # Combine all text parts
        return " ".join(text_parts)
    
    def _extract_product_info(self, product: Dict[str, Any]) -> Dict[str, Any]:
        """Extract relevant product information for recommendations"""
        return {
            "id": str(product["_id"]),
            "name": product.get("name", ""),
            "description": product.get("description", "")[:100] + "..." if len(product.get("description", "")) > 100 else product.get("description", ""),
            "price": product.get("basePrice", 0),
            "image": product.get("images", [])[0] if product.get("images") else None,
            "category_id": str(product.get("categoryId")) if product.get("categoryId") else None
        }
    
    async def _get_user_history(self, user_id: str) -> List[Dict[str, Any]]:
        """Get user's browsing and purchase history"""
        history = []
        
        # Get view history
        views = await mongo_client.find_many(
            "productViews",
            {"userId": ObjectId(user_id)},
            sort=[("createdAt", -1)],
            limit=50
        )
        
        for view in views:
            history.append({
                "productId": str(view["productId"]),
                "type": "view",
                "timestamp": view["createdAt"]
            })
        
        # Get cart items
        cart = await mongo_client.find_one(
            "carts",
            {"userId": ObjectId(user_id)}
        )
        
        if cart and "items" in cart:
            for item in cart["items"]:
                history.append({
                    "productId": str(item["productId"]),
                    "type": "add_to_cart",
                    "timestamp": item.get("updatedAt", datetime.now())
                })
        
        # Get wishlist items
        wishlist = await mongo_client.find_many(
            "wishlist",
            {"userId": ObjectId(user_id)}
        )
        
        for item in wishlist:
            history.append({
                "productId": str(item["productId"]),
                "type": "add_to_wishlist",
                "timestamp": item.get("createdAt", datetime.now())
            })
        
        # Get purchase history
        orders = await mongo_client.find_many(
            "orders",
            {"userId": ObjectId(user_id)}
        )
        
        for order in orders:
            if "items" in order:
                for item in order["items"]:
                    history.append({
                        "productId": str(item["productId"]),
                        "type": "purchase",
                        "timestamp": order.get("createdAt", datetime.now())
                    })
        
        return history
    
    async def get_personalized_recommendations(
        self, 
        user_id: str, 
        limit: int = 10,
        include_viewed: bool = False
    ) -> List[Dict[str, Any]]:
        """Get personalized product recommendations for a user"""
        await self.initialize()
        
        try:
            # Check if user embedding exists
            if user_id not in self.user_embeddings:
                # Try to generate it
                success = await self.update_user_embedding(user_id)
                
                if not success:
                    # Fall back to popular products
                    logger.info(f"No embedding available for user {user_id}, falling back to popular products")
                    return await self.get_popular_products(limit)
            
            # Get user's previously viewed and purchased products
            excluded_product_ids = set()
            
            if not include_viewed:
                # Get product view history
                views = await mongo_client.find_many(
                    "productViews",
                    {"userId": ObjectId(user_id)}
                )
                
                for view in views:
                    excluded_product_ids.add(str(view["productId"]))
                
                # Get purchase history
                orders = await mongo_client.find_many(
                    "orders",
                    {"userId": ObjectId(user_id)}
                )
                
                for order in orders:
                    if "items" in order:
                        for item in order["items"]:
                            excluded_product_ids.add(str(item["productId"]))
            
            # Calculate similarity between user embedding and all product embeddings
            user_embedding = self.user_embeddings[user_id]
            
            # Calculate similarities and rank products
            similarities = []
            
            for prod_id, embedding in self.product_embeddings.items():
                # Skip excluded products
                if prod_id in excluded_product_ids:
                    continue
                
                # Calculate cosine similarity
                similarity = cosine_similarity([user_embedding], [embedding])[0][0]
                
                similarities.append((prod_id, similarity))
            
            # Sort by similarity (descending)
            similarities.sort(key=lambda x: x[1], reverse=True)
            
            # Get top recommendations
            top_recommendations = similarities[:limit]
            
            # Fetch product details
            recommendations = []
            
            for prod_id, similarity in top_recommendations:
                if prod_id in self.product_info_cache:
                    product_info = self.product_info_cache[prod_id]
                    product_info["similarity_score"] = float(similarity)
                    recommendations.append(product_info)
                else:
                    # Get product from database
                    product = await mongo_client.find_one(
                        "products",
                        {"_id": ObjectId(prod_id)}
                    )
                    
                    if product:
                        product_info = self._extract_product_info(product)
                        product_info["similarity_score"] = float(similarity)
                        recommendations.append(product_info)
                        
                        # Update cache
                        self.product_info_cache[prod_id] = product_info
            
            return recommendations
        
        except Exception as e:
            logger.error(f"Error getting personalized recommendations: {str(e)}")
            # Fall back to popular products
            return await self.get_popular_products(limit)
    
    async def get_similar_products(self, product_id: str, limit: int = 10) -> List[Dict[str, Any]]:
        """Get products similar to a given product"""
        await self.initialize()
        
        try:
            # Check if product embedding exists
            if product_id not in self.product_embeddings:
                # Get product from database
                product = await mongo_client.find_one(
                    "products",
                    {"_id": ObjectId(product_id)}
                )
                
                if not product:
                    logger.warning(f"Product {product_id} not found")
                    return []
                
                # Generate embedding
                product_text = await self._get_product_text(product)
                embedding = await self.embedding_model.get_embedding(product_text)
                
                # Store embedding
                self.product_embeddings[product_id] = embedding
                
                # Cache product info
                self.product_info_cache[product_id] = self._extract_product_info(product)
            
            # Calculate similarity between product embedding and all other product embeddings
            product_embedding = self.product_embeddings[product_id]
            
            # Calculate similarities and rank products
            similarities = []
            
            for prod_id, embedding in self.product_embeddings.items():
                # Skip the input product
                if prod_id == product_id:
                    continue
                
                # Calculate cosine similarity
                similarity = cosine_similarity([product_embedding], [embedding])[0][0]
                
                similarities.append((prod_id, similarity))
            
            # Sort by similarity (descending)
            similarities.sort(key=lambda x: x[1], reverse=True)
            
            # Get top similar products
            top_similar = similarities[:limit]
            
            # Fetch product details
            similar_products = []
            
            for prod_id, similarity in top_similar:
                if prod_id in self.product_info_cache:
                    product_info = self.product_info_cache[prod_id]
                    product_info["similarity_score"] = float(similarity)
                    similar_products.append(product_info)
                else:
                    # Get product from database
                    product = await mongo_client.find_one(
                        "products",
                        {"_id": ObjectId(prod_id)}
                    )
                    
                    if product:
                        product_info = self._extract_product_info(product)
                        product_info["similarity_score"] = float(similarity)
                        similar_products.append(product_info)
                        
                        # Update cache
                        self.product_info_cache[prod_id] = product_info
            
            return similar_products
        
        except Exception as e:
            logger.error(f"Error getting similar products: {str(e)}")
            return []
    
    async def get_popular_products(self, limit: int = 10) -> List[Dict[str, Any]]:
        """Get popular products"""
        await self.initialize()
        
        try:
            # Query for popular products based on views, orders, and ratings
            # In a real implementation, this would be more sophisticated
            
            # Aggregate product views
            view_counts = await mongo_client.aggregate(
                "productViews",
                [
                    {"$group": {"_id": "$productId", "count": {"$sum": 1}}},
                    {"$sort": {"count": -1}},
                    {"$limit": limit * 2}  # Get more than needed to filter out inactive
                ]
            )
            
            # Get product details for popular products
            popular_products = []
            
            for view in view_counts:
                prod_id = str(view["_id"])
                
                # Check product info cache
                if prod_id in self.product_info_cache:
                    product_info = self.product_info_cache[prod_id]
                    product_info["popularity_score"] = view["count"]
                    popular_products.append(product_info)
                else:
                    # Get product from database
                    product = await mongo_client.find_one(
                        "products",
                        {"_id": view["_id"], "isDeleted": {"$ne": True}}
                    )
                    
                    if product:
                        product_info = self._extract_product_info(product)
                        product_info["popularity_score"] = view["count"]
                        popular_products.append(product_info)
                        
                        # Update cache
                        self.product_info_cache[prod_id] = product_info
            
            # Limit results
            return popular_products[:limit]
        
        except Exception as e:
            logger.error(f"Error getting popular products: {str(e)}")
            
            # Fallback to recent products if aggregation fails
            products = await mongo_client.find_many(
                "products",
                {"isDeleted": {"$ne": True}},
                sort=[("createdAt", -1)],
                limit=limit
            )
            
            return [self._extract_product_info(product) for product in products]
    
    async def get_category_recommendations(self, category_id: str, limit: int = 10) -> List[Dict[str, Any]]:
        """Get recommendations for a specific category"""
        await self.initialize()
        
        try:
            # Get popular products in category
            products = await mongo_client.find_many(
                "products",
                {"categoryId": ObjectId(category_id), "isDeleted": {"$ne": True}},
                limit=limit * 2  # Get more than needed
            )
            
            # Get product view counts for sorting
            product_ids = [product["_id"] for product in products]
            
            view_counts = await mongo_client.aggregate(
                "productViews",
                [
                    {"$match": {"productId": {"$in": product_ids}}},
                    {"$group": {"_id": "$productId", "count": {"$sum": 1}}},
                    {"$sort": {"count": -1}}
                ]
            )
            
            # Create view count map
            view_count_map = {str(view["_id"]): view["count"] for view in view_counts}
            
            # Sort products by view count
            products_with_counts = [
                (product, view_count_map.get(str(product["_id"]), 0))
                for product in products
            ]
            
            products_with_counts.sort(key=lambda x: x[1], reverse=True)
            
            # Extract product info
            recommendations = []
            
            for product, view_count in products_with_counts[:limit]:
                prod_id = str(product["_id"])
                
                if prod_id in self.product_info_cache:
                    product_info = self.product_info_cache[prod_id]
                else:
                    product_info = self._extract_product_info(product)
                    self.product_info_cache[prod_id] = product_info
                
                product_info["popularity_score"] = view_count
                recommendations.append(product_info)
            
            return recommendations
        
        except Exception as e:
            logger.error(f"Error getting category recommendations: {str(e)}")
            return []
    
    async def get_keyword_recommendations(self, keywords: List[str], limit: int = 10) -> List[Dict[str, Any]]:
        """Get recommendations based on keywords"""
        await self.initialize()
        
        try:
            # Generate an embedding for the keywords
            keyword_text = " ".join(keywords)
            keyword_embedding = await self.embedding_model.get_embedding(keyword_text)
            
            # Calculate similarity between keyword embedding and all product embeddings
            similarities = []
            
            for prod_id, embedding in self.product_embeddings.items():
                # Calculate cosine similarity
                similarity = cosine_similarity([keyword_embedding], [embedding])[0][0]
                
                similarities.append((prod_id, similarity))
            
            # Sort by similarity (descending)
            similarities.sort(key=lambda x: x[1], reverse=True)
            
            # Get top recommendations
            top_recommendations = similarities[:limit]
            
            # Fetch product details
            recommendations = []
            
            for prod_id, similarity in top_recommendations:
                if prod_id in self.product_info_cache:
                    product_info = self.product_info_cache[prod_id]
                    product_info["similarity_score"] = float(similarity)
                    recommendations.append(product_info)
                else:
                    # Get product from database
                    product = await mongo_client.find_one(
                        "products",
                        {"_id": ObjectId(prod_id)}
                    )
                    
                    if product:
                        product_info = self._extract_product_info(product)
                        product_info["similarity_score"] = float(similarity)
                        recommendations.append(product_info)
                        
                        # Update cache
                        self.product_info_cache[prod_id] = product_info
            
            return recommendations
        
        except Exception as e:
            logger.error(f"Error getting keyword recommendations: {str(e)}")
            return []