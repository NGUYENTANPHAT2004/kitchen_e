from fastapi import APIRouter, Depends, HTTPException, Body, Query, status
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import logging
from datetime import datetime
import uuid
from app.models.chat_model import ChatModel
from app.utils.db_connector import mongo_client
from app.config import settings
from app.utils.service_auth import require_service_key
from bson import ObjectId

logger = logging.getLogger(__name__)
router = APIRouter(dependencies=[Depends(require_service_key)])

# Initialize the chat model
chat_model = ChatModel()

class ChatMessage(BaseModel):
    content: str
    role: str = "user"
    timestamp: Optional[datetime] = None

class ChatSessionCreate(BaseModel):
    user_id: Optional[str] = None
    session_id: Optional[str] = None
    message: str = Field(min_length=1, max_length=2000)
    language: Optional[str] = "vi"

class ChatResponse(BaseModel):
    session_id: str
    response: str
    intent_type: str
    intent_confidence: Optional[float] = None
    model_version: Optional[str] = None
    suggested_actions: Optional[List[Dict[str, Any]]] = None
    suggested_products: Optional[List[Dict[str, Any]]] = None
    suggested_recipes: Optional[List[Dict[str, Any]]] = None

@router.post("/message", response_model=ChatResponse)
async def chat_message(
    chat_request: ChatSessionCreate = Body(...)
):
    """
    Send a message to the chatbot and get a response
    """
    try:
        # Generate or use provided session ID
        session_id = chat_request.session_id or str(uuid.uuid4())
        user_id = chat_request.user_id
        
        # Get conversation history if session exists
        history = []
        if session_id:
            conversation = await mongo_client.find_one(
                "aiassistantlogs",
                {"sessionId": session_id, "userId": ObjectId(user_id) if user_id else None}
            )
            
            if conversation:
                # Get previous messages for context. The window size is driven
                # by settings.MAX_CONVERSATION_HISTORY (turns) so long
                # conversations keep enough context without unbounded growth.
                previous_messages = await mongo_client.find_many(
                    "aiassistantlogs",
                    {"sessionId": session_id, "userId": ObjectId(user_id) if user_id else None},
                    sort=[("createdAt", -1)],
                    limit=settings.MAX_CONVERSATION_HISTORY
                )
                
                for msg in reversed(previous_messages):
                    history.append({"role": "user", "content": msg["query"]})
                    history.append({"role": "assistant", "content": msg["response"]})
        
        # Process user's message
        response_data = await chat_model.generate_response(
            chat_request.message,
            history=history,
            language=chat_request.language,
            user_id=user_id
        )
        
        # Extract response and metadata
        response_text = response_data["response"]
        intent_type = response_data["intent_type"]
        suggested_actions = response_data.get("suggested_actions", [])
        suggested_products = response_data.get("suggested_products", [])
        suggested_recipes = response_data.get("suggested_recipes", [])
        
        # Node records the authoritative log once, after the response succeeds.
        
        return {
            "session_id": session_id,
            "response": response_text,
            "intent_type": intent_type,
            "intent_confidence": response_data.get("intent_confidence"),
            "model_version": response_data.get("model_version"),
            "suggested_actions": suggested_actions,
            "suggested_products": suggested_products,
            "suggested_recipes": suggested_recipes
        }
    
    except Exception as e:
        logger.error(f"Error processing chat message: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to process chat message: {str(e)}"
        )

@router.get("/history")
async def get_chat_history(
    session_id: Optional[str] = Query(None),
    user_id: Optional[str] = Query(None),
    limit: int = Query(20, ge=1, le=100)
):
    """
    Get chat history for a session or user
    """
    try:
        query = {}
        
        if session_id:
            query["sessionId"] = session_id
        elif user_id:
            query["userId"] = ObjectId(user_id)
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Either session_id or user_id must be provided"
            )
        
        # Get chat history
        history = await mongo_client.find_many(
            "aiassistantlogs",
            query,
            sort=[("createdAt", -1)],
            limit=limit
        )
        
        # Format response
        formatted_history = []
        for item in history:
            formatted_item = {
                "id": str(item["_id"]),
                "session_id": item["sessionId"],
                "user_id": str(item["userId"]) if item.get("userId") else None,
                "query": item["query"],
                "response": item["response"],
                "intent_type": item["intentType"],
                "query_source": item["querySource"],
                "created_at": item["createdAt"].isoformat(),
                "response_time": item["responseTime"]
            }
            
            # Add feedback if available
            if "feedback" in item:
                formatted_item["feedback"] = item["feedback"]
                
            formatted_history.append(formatted_item)
        
        return {
            "count": len(formatted_history),
            "history": formatted_history
        }
    
    except HTTPException as e:
        raise e
    except Exception as e:
        logger.error(f"Error retrieving chat history: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve chat history: {str(e)}"
        )

@router.post("/feedback/{log_id}")
async def provide_feedback(
    log_id: str,
    is_helpful: bool = Body(...),
    comments: Optional[str] = Body(None)
):
    """
    Provide feedback on a chat response
    """
    try:
        # Find the log entry
        log = await mongo_client.find_one(
            "aiassistantlogs",
            {"_id": ObjectId(log_id)}
        )
        
        if not log:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Log entry not found"
            )
        
        # Update with feedback
        feedback_data = {
            "feedback": {
                "isHelpful": is_helpful,
                "comments": comments,
                "providedAt": datetime.utcnow()
            }
        }
        
        await mongo_client.update_one(
            "aiassistantlogs",
            {"_id": ObjectId(log_id)},
            {"$set": feedback_data}
        )
        
        return {
            "success": True,
            "message": "Feedback provided successfully"
        }
    
    except HTTPException as e:
        raise e
    except Exception as e:
        logger.error(f"Error providing feedback: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to provide feedback: {str(e)}"
        )

@router.get("/suggestions")
async def get_suggestions(
    user_id: Optional[str] = Query(None),
    query: Optional[str] = Query(None),
    limit: int = Query(5, ge=1, le=20)
):
    """
    Get quick reply suggestions based on user history or current query
    """
    try:
        suggestions = await chat_model.get_suggestions(user_id, query, limit)
        return {
            "suggestions": suggestions
        }
    
    except Exception as e:
        logger.error(f"Error getting suggestions: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get suggestions: {str(e)}"
        )
