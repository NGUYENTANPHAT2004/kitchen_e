from fastapi import APIRouter, Depends, HTTPException, Body, Query, Path, status
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
import logging
from datetime import datetime
from app.utils.db_connector import mongo_client
from bson import ObjectId

logger = logging.getLogger(__name__)
router = APIRouter()

# The product embedding model (PhoBERT) is reused to rank recipes by semantic
# similarity to a free-text query — same approach as product recommendation.
# Imported lazily so the router still loads (and falls back to text search)
# in environments without torch / transformers installed.
_embedding_model = None
_embedding_unavailable = False


async def _get_embedding_model():
    """Return an initialized ProductEmbeddingModel, or None if unavailable."""
    global _embedding_model, _embedding_unavailable
    if _embedding_unavailable:
        return None
    if _embedding_model is not None:
        return _embedding_model
    try:
        from app.models.product_embedding import ProductEmbeddingModel
        model = ProductEmbeddingModel()
        await model.initialize()
        _embedding_model = model
        return model
    except Exception as e:
        logger.warning(
            f"Embedding model unavailable, recipe search falls back to text: {str(e)}"
        )
        _embedding_unavailable = True
        return None


class RecipeRecommendationRequest(BaseModel):
    user_id: Optional[str] = None
    product_id: Optional[str] = None
    ingredients: Optional[List[str]] = None
    cuisine_type: Optional[str] = None
    difficulty: Optional[str] = None
    query: Optional[str] = None
    max_preparation_time: Optional[int] = None
    limit: int = Field(10, ge=1, le=50)

class RecipeRecommendationResponse(BaseModel):
    recipes: List[Dict[str, Any]]
    recommendation_type: str

@router.post("/recommend", response_model=RecipeRecommendationResponse)
async def recommend_recipes(request: RecipeRecommendationRequest = Body(...)):
    """
    Get recipe recommendations based on various parameters
    """
    try:
        # Determine recommendation type based on input
        if request.product_id:
            # Recommend recipes that use this product
            recipes = await get_recipes_by_product(
                request.product_id,
                limit=request.limit
            )
            recommendation_type = "product_based"
            
        elif request.user_id:
            # Personalized recipe recommendations
            recipes = await get_personalized_recipes(
                request.user_id,
                limit=request.limit,
                max_preparation_time=request.max_preparation_time,
                difficulty=request.difficulty
            )
            recommendation_type = "personalized"
            
        elif request.ingredients:
            # Recommend recipes that use these ingredients
            recipes = await get_recipes_by_ingredients(
                request.ingredients,
                limit=request.limit,
                max_preparation_time=request.max_preparation_time,
                difficulty=request.difficulty
            )
            recommendation_type = "ingredient_based"
            
        elif request.cuisine_type:
            # Recommend recipes of a specific cuisine
            recipes = await get_recipes_by_cuisine(
                request.cuisine_type,
                limit=request.limit,
                max_preparation_time=request.max_preparation_time,
                difficulty=request.difficulty
            )
            recommendation_type = "cuisine_based"

        elif request.query:
            # Free-text query -> semantic similarity ranking (embedding based)
            recipes = await get_recipes_by_semantic_search(
                request.query,
                limit=request.limit,
                max_preparation_time=request.max_preparation_time,
                difficulty=request.difficulty
            )
            recommendation_type = "semantic"

        else:
            # Fallback to popular recipes
            recipes = await get_popular_recipes(
                limit=request.limit,
                max_preparation_time=request.max_preparation_time,
                difficulty=request.difficulty
            )
            recommendation_type = "popular"
        
        # Log recommendation request if user_id provided
        if request.user_id:
            log_data = {
                "userId": ObjectId(request.user_id),
                "recommendationType": recommendation_type,
                "parameters": {
                    "productId": request.product_id,
                    "ingredients": request.ingredients,
                    "cuisineType": request.cuisine_type,
                    "difficulty": request.difficulty,
                    "maxPreparationTime": request.max_preparation_time,
                    "limit": request.limit
                },
                "resultCount": len(recipes),
                "createdAt": datetime.utcnow()
            }
            await mongo_client.insert_one("recipeRecommendationLogs", log_data)
        
        return {
            "recipes": recipes,
            "recommendation_type": recommendation_type
        }
    
    except Exception as e:
        logger.error(f"Error generating recipe recommendations: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate recipe recommendations: {str(e)}"
        )

@router.get("/popular", response_model=RecipeRecommendationResponse)
async def get_popular_recipes_api(
    limit: int = Query(10, ge=1, le=50),
    max_preparation_time: Optional[int] = Query(None),
    difficulty: Optional[str] = Query(None)
):
    """
    Get popular recipes
    """
    try:
        recipes = await get_popular_recipes(
            limit=limit,
            max_preparation_time=max_preparation_time,
            difficulty=difficulty
        )
        
        return {
            "recipes": recipes,
            "recommendation_type": "popular"
        }
    
    except Exception as e:
        logger.error(f"Error getting popular recipes: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get popular recipes: {str(e)}"
        )

@router.get("/search", response_model=RecipeRecommendationResponse)
async def search_recipes_api(
    query: str = Query(..., min_length=1),
    limit: int = Query(10, ge=1, le=50),
    max_preparation_time: Optional[int] = Query(None),
    difficulty: Optional[str] = Query(None)
):
    """
    Search recipes by free-text query, ranked by semantic similarity
    (PhoBERT embeddings) with a text-search fallback.
    """
    try:
        recipes = await get_recipes_by_semantic_search(
            query,
            limit=limit,
            max_preparation_time=max_preparation_time,
            difficulty=difficulty
        )

        return {
            "recipes": recipes,
            "recommendation_type": "semantic"
        }

    except Exception as e:
        logger.error(f"Error searching recipes: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to search recipes: {str(e)}"
        )

@router.get("/by-product/{product_id}", response_model=RecipeRecommendationResponse)
async def get_recipes_by_product_api(
    product_id: str = Path(...),
    limit: int = Query(10, ge=1, le=50)
):
    """
    Get recipes that use a specific product
    """
    try:
        recipes = await get_recipes_by_product(
            product_id,
            limit=limit
        )
        
        return {
            "recipes": recipes,
            "recommendation_type": "product_based"
        }
    
    except Exception as e:
        logger.error(f"Error getting recipes by product: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get recipes by product: {str(e)}"
        )

@router.get("/by-ingredients", response_model=RecipeRecommendationResponse)
async def get_recipes_by_ingredients_api(
    ingredients: List[str] = Query(...),
    limit: int = Query(10, ge=1, le=50),
    max_preparation_time: Optional[int] = Query(None),
    difficulty: Optional[str] = Query(None)
):
    """
    Get recipes that use specific ingredients
    """
    try:
        recipes = await get_recipes_by_ingredients(
            ingredients,
            limit=limit,
            max_preparation_time=max_preparation_time,
            difficulty=difficulty
        )
        
        return {
            "recipes": recipes,
            "recommendation_type": "ingredient_based"
        }
    
    except Exception as e:
        logger.error(f"Error getting recipes by ingredients: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get recipes by ingredients: {str(e)}"
        )

@router.get("/personalized/{user_id}", response_model=RecipeRecommendationResponse)
async def get_personalized_recipes_api(
    user_id: str = Path(...),
    limit: int = Query(10, ge=1, le=50),
    max_preparation_time: Optional[int] = Query(None),
    difficulty: Optional[str] = Query(None)
):
    """
    Get personalized recipe recommendations for a user
    """
    try:
        recipes = await get_personalized_recipes(
            user_id,
            limit=limit,
            max_preparation_time=max_preparation_time,
            difficulty=difficulty
        )
        
        # Log recommendation request
        log_data = {
            "userId": ObjectId(user_id),
            "recommendationType": "personalized",
            "parameters": {
                "limit": limit,
                "maxPreparationTime": max_preparation_time,
                "difficulty": difficulty
            },
            "resultCount": len(recipes),
            "createdAt": datetime.utcnow()
        }
        await mongo_client.insert_one("recipeRecommendationLogs", log_data)
        
        return {
            "recipes": recipes,
            "recommendation_type": "personalized"
        }
    
    except Exception as e:
        logger.error(f"Error getting personalized recipes: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get personalized recipes: {str(e)}"
        )

@router.post("/feedback")
async def record_recipe_feedback(
    user_id: str = Body(...),
    recipe_id: str = Body(...),
    action: str = Body(...),  # viewed, favorited, cooked, rated
    rating: Optional[int] = Body(None),
    comment: Optional[str] = Body(None)
):
    """
    Record user feedback on recipes for improving recommendations
    """
    try:
        # Verify user exists
        user = await mongo_client.find_one("users", {"_id": ObjectId(user_id)})
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        # Verify recipe exists
        recipe = await mongo_client.find_one("recipes", {"_id": ObjectId(recipe_id)})
        if not recipe:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Recipe not found"
            )
        
        # Record feedback
        feedback_data = {
            "userId": ObjectId(user_id),
            "recipeId": ObjectId(recipe_id),
            "action": action,
            "createdAt": datetime.utcnow()
        }
        
        if rating is not None:
            feedback_data["rating"] = rating
            
        if comment:
            feedback_data["comment"] = comment
        
        await mongo_client.insert_one("recipeFeedback", feedback_data)
        
        # If it's a rating, update the recipe's average rating
        if action == "rated" and rating is not None:
            # Get all ratings for this recipe
            all_ratings = await mongo_client.find_many(
                "recipeFeedback",
                {"recipeId": ObjectId(recipe_id), "action": "rated", "rating": {"$exists": True}}
            )
            
            total_rating = sum(r["rating"] for r in all_ratings)
            avg_rating = total_rating / len(all_ratings) if all_ratings else 0
            
            # Update recipe with new average rating
            await mongo_client.update_one(
                "recipes",
                {"_id": ObjectId(recipe_id)},
                {"$set": {"avgRating": avg_rating, "ratingCount": len(all_ratings)}}
            )
        
        return {
            "success": True,
            "message": "Feedback recorded successfully"
        }
    
    except HTTPException as e:
        raise e
    except Exception as e:
        logger.error(f"Error recording recipe feedback: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to record recipe feedback: {str(e)}"
        )

# Helper functions for recipe recommendations

def _recipe_to_text(recipe: Dict[str, Any]) -> str:
    """Build a text representation of a recipe for embedding."""
    parts = [recipe.get("title", ""), recipe.get("description", "")]
    cuisine = recipe.get("cuisineType")
    if cuisine:
        parts.append(cuisine)
    ingredients = recipe.get("ingredients", []) or []
    ingredient_names = [
        ing["name"] for ing in ingredients
        if isinstance(ing, dict) and ing.get("name")
    ]
    if ingredient_names:
        parts.append(" ".join(ingredient_names))
    return " ".join(p for p in parts if p).strip()


async def get_recipes_by_semantic_search(
    query: str,
    limit: int = 10,
    max_preparation_time: Optional[int] = None,
    difficulty: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """
    Rank recipes by semantic similarity to a free-text query using PhoBERT
    embeddings (same technique as product recommendation).

    Falls back to MongoDB text matching on title/description when the embedding
    model is unavailable, so the endpoint always returns something usable.
    """
    # Build the candidate filter (preparation time / difficulty).
    candidate_query: Dict[str, Any] = {}
    if max_preparation_time is not None:
        candidate_query["preparationTime"] = {"$lte": max_preparation_time}
    if difficulty:
        candidate_query["difficulty"] = difficulty

    recipes = await mongo_client.find_many("recipes", candidate_query)
    if not recipes:
        return []

    model = await _get_embedding_model()

    if model is None:
        # Fallback: simple case-insensitive substring match, then popularity.
        q = query.lower().strip()
        matched = [
            r for r in recipes
            if q in r.get("title", "").lower()
            or q in r.get("description", "").lower()
        ]
        matched.sort(key=lambda r: r.get("avgRating", 0), reverse=True)
        return [format_recipe(r) for r in matched[:limit]]

    # Semantic ranking: embed the query and every candidate, score by cosine.
    query_embedding = await model.get_embedding(query)

    scored = []
    for recipe in recipes:
        recipe_text = _recipe_to_text(recipe)
        if not recipe_text:
            continue
        recipe_embedding = await model.get_embedding(recipe_text)
        score = model._cosine_similarity(query_embedding, recipe_embedding)
        scored.append((recipe, score))

    scored.sort(key=lambda x: x[1], reverse=True)

    results = []
    for recipe, score in scored[:limit]:
        formatted = format_recipe(recipe)
        formatted["similarity_score"] = float(score)
        results.append(formatted)

    return results


async def get_popular_recipes(
    limit: int = 10,
    max_preparation_time: Optional[int] = None,
    difficulty: Optional[str] = None
) -> List[Dict[str, Any]]:
    """Get popular recipes"""
    # Build query
    query = {}
    
    if max_preparation_time is not None:
        query["preparationTime"] = {"$lte": max_preparation_time}
        
    if difficulty:
        query["difficulty"] = difficulty
    
    # Get recipes sorted by popularity metrics
    recipes = await mongo_client.find_many(
        "recipes",
        query,
        sort=[("avgRating", -1), ("viewCount", -1)],
        limit=limit
    )
    
    # Format response
    return [format_recipe(recipe) for recipe in recipes]

async def get_recipes_by_product(product_id: str, limit: int = 10) -> List[Dict[str, Any]]:
    """Get recipes that use a specific product"""
    # Find recipe links for this product
    recipe_links = await mongo_client.find_many(
        "recipeProductLinks",
        {"productId": ObjectId(product_id)}
    )
    
    if not recipe_links:
        return []
    
    # Extract recipe IDs
    recipe_ids = [link["recipeId"] for link in recipe_links]
    
    # Get recipes
    recipes = await mongo_client.find_many(
        "recipes",
        {"_id": {"$in": recipe_ids}},
        sort=[("avgRating", -1)],
        limit=limit
    )
    
    # Format response
    return [format_recipe(recipe) for recipe in recipes]

async def get_recipes_by_ingredients(
    ingredients: List[str],
    limit: int = 10,
    max_preparation_time: Optional[int] = None,
    difficulty: Optional[str] = None
) -> List[Dict[str, Any]]:
    """Get recipes that use specific ingredients"""
    # Build query
    query = {"ingredients.name": {"$all": ingredients}}
    
    if max_preparation_time is not None:
        query["preparationTime"] = {"$lte": max_preparation_time}
        
    if difficulty:
        query["difficulty"] = difficulty
    
    # Get recipes
    recipes = await mongo_client.find_many(
        "recipes",
        query,
        sort=[("avgRating", -1)],
        limit=limit
    )
    
    # Format response
    return [format_recipe(recipe) for recipe in recipes]

async def get_recipes_by_cuisine(
    cuisine_type: str,
    limit: int = 10,
    max_preparation_time: Optional[int] = None,
    difficulty: Optional[str] = None
) -> List[Dict[str, Any]]:
    """Get recipes of a specific cuisine"""
    # Build query
    query = {"cuisineType": cuisine_type}
    
    if max_preparation_time is not None:
        query["preparationTime"] = {"$lte": max_preparation_time}
        
    if difficulty:
        query["difficulty"] = difficulty
    
    # Get recipes
    recipes = await mongo_client.find_many(
        "recipes",
        query,
        sort=[("avgRating", -1)],
        limit=limit
    )
    
    # Format response
    return [format_recipe(recipe) for recipe in recipes]

async def get_personalized_recipes(
    user_id: str,
    limit: int = 10,
    max_preparation_time: Optional[int] = None,
    difficulty: Optional[str] = None
) -> List[Dict[str, Any]]:
    """Get personalized recipe recommendations for a user"""
    # Get user's preferred ingredients and cuisines based on history
    user_preferences = await get_user_recipe_preferences(user_id)
    
    # Get user's previously rated recipes
    rated_recipes = await mongo_client.find_many(
        "recipeFeedback",
        {"userId": ObjectId(user_id), "action": "rated"}
    )
    
    # Exclude recipes user has already rated or viewed many times
    exclude_recipe_ids = []
    for feedback in rated_recipes:
        if feedback.get("rating", 0) < 3:  # Exclude low-rated recipes
            exclude_recipe_ids.append(feedback["recipeId"])
    
    # Build query
    query = {"_id": {"$nin": exclude_recipe_ids}}
    
    if max_preparation_time is not None:
        query["preparationTime"] = {"$lte": max_preparation_time}
        
    if difficulty:
        query["difficulty"] = difficulty
    
    # Add preferred cuisine types if available
    if user_preferences.get("cuisines"):
        preferred_cuisines = user_preferences["cuisines"][:3]  # Top 3 cuisines
        query["cuisineType"] = {"$in": preferred_cuisines}
    
    # Get recipes
    recipes = await mongo_client.find_many(
        "recipes",
        query,
        sort=[("avgRating", -1)],
        limit=limit * 2  # Get more than needed for filtering
    )
    
    # Sort recipes based on user preferences
    scored_recipes = []
    
    for recipe in recipes:
        score = 0
        
        # Score based on preferred ingredients
        if user_preferences.get("ingredients") and recipe.get("ingredients"):
            recipe_ingredients = [ing["name"] for ing in recipe.get("ingredients", [])]
            for ingredient in user_preferences["ingredients"]:
                if ingredient in recipe_ingredients:
                    score += 1
        
        # Score based on difficulty preference
        if user_preferences.get("preferred_difficulty") and recipe.get("difficulty"):
            if recipe["difficulty"] == user_preferences["preferred_difficulty"]:
                score += 2
        
        # Score based on preparation time preference
        if user_preferences.get("avg_preparation_time") and recipe.get("preparationTime"):
            user_avg_time = user_preferences["avg_preparation_time"]
            recipe_time = recipe["preparationTime"]
            
            # Score higher if recipe time is close to user's preferred time
            time_diff = abs(recipe_time - user_avg_time)
            if time_diff <= 10:
                score += 3
            elif time_diff <= 20:
                score += 2
            elif time_diff <= 30:
                score += 1
        
        # Add base score for highly rated recipes
        score += recipe.get("avgRating", 0) * 2
        
        scored_recipes.append((recipe, score))
    
    # Sort by score (descending)
    scored_recipes.sort(key=lambda x: x[1], reverse=True)
    
    # Format response with top recipes
    return [format_recipe(recipe) for recipe, _ in scored_recipes[:limit]]

async def get_user_recipe_preferences(user_id: str) -> Dict[str, Any]:
    """Analyze user's recipe interactions to determine preferences"""
    # Get user's recipe feedback
    feedback = await mongo_client.find_many(
        "recipeFeedback",
        {"userId": ObjectId(user_id)}
    )
    
    if not feedback:
        return {}
    
    # Extract recipe IDs with positive feedback
    positive_recipe_ids = []
    for item in feedback:
        if item["action"] == "rated" and item.get("rating", 0) >= 4:
            positive_recipe_ids.append(item["recipeId"])
        elif item["action"] in ["favorited", "cooked"]:
            positive_recipe_ids.append(item["recipeId"])
    
    if not positive_recipe_ids:
        return {}
    
    # Get the positively rated recipes
    positive_recipes = await mongo_client.find_many(
        "recipes",
        {"_id": {"$in": positive_recipe_ids}}
    )
    
    if not positive_recipes:
        return {}
    
    # Analyze preferences
    ingredient_counts = {}
    cuisine_counts = {}
    difficulty_counts = {}
    preparation_times = []
    
    for recipe in positive_recipes:
        # Count ingredients
        for ingredient in recipe.get("ingredients", []):
            ingredient_name = ingredient["name"]
            ingredient_counts[ingredient_name] = ingredient_counts.get(ingredient_name, 0) + 1
        
        # Count cuisines
        cuisine = recipe.get("cuisineType")
        if cuisine:
            cuisine_counts[cuisine] = cuisine_counts.get(cuisine, 0) + 1
        
        # Count difficulties
        difficulty = recipe.get("difficulty")
        if difficulty:
            difficulty_counts[difficulty] = difficulty_counts.get(difficulty, 0) + 1
        
        # Track preparation times
        if recipe.get("preparationTime"):
            preparation_times.append(recipe["preparationTime"])
    
    # Determine preferred ingredients (sorted by frequency)
    preferred_ingredients = sorted(ingredient_counts.keys(), key=lambda x: ingredient_counts[x], reverse=True)
    
    # Determine preferred cuisines (sorted by frequency)
    preferred_cuisines = sorted(cuisine_counts.keys(), key=lambda x: cuisine_counts[x], reverse=True)
    
    # Determine preferred difficulty
    preferred_difficulty = max(difficulty_counts.items(), key=lambda x: x[1])[0] if difficulty_counts else None
    
    # Calculate average preparation time
    avg_preparation_time = sum(preparation_times) / len(preparation_times) if preparation_times else None
    
    return {
        "ingredients": preferred_ingredients,
        "cuisines": preferred_cuisines,
        "preferred_difficulty": preferred_difficulty,
        "avg_preparation_time": avg_preparation_time
    }

def format_recipe(recipe: Dict[str, Any]) -> Dict[str, Any]:
    """Format recipe data for API response"""
    return {
        "id": str(recipe["_id"]),
        "title": recipe.get("title", ""),
        "description": recipe.get("description", ""),
        "preparationTime": recipe.get("preparationTime", 0),
        "difficulty": recipe.get("difficulty", "medium"),
        "instructions": recipe.get("instructions", []),
        "ingredients": recipe.get("ingredients", []),
        "cuisineType": recipe.get("cuisineType", ""),
        "avgRating": recipe.get("avgRating", 0),
        "ratingCount": recipe.get("ratingCount", 0),
        "image": recipe.get("image", "")
    }