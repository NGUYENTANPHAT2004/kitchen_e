from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Body, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel
import logging
import uuid
import os
import aiofiles
from typing import Optional
from datetime import datetime
import numpy as np
from app.models.face_detection import FaceRecognitionModel
from app.utils.db_connector import mongo_client
from app.utils.error_handler import handle_exceptions
from app.config import settings
from bson import ObjectId

logger = logging.getLogger(__name__)
router = APIRouter()

face_model = FaceRecognitionModel()

class FaceAuthResponse(BaseModel):
    success: bool
    message: str
    user_id: Optional[str] = None
    confidence: Optional[float] = None

class RegisterFaceRequest(BaseModel):
    user_id: str
    override_existing: Optional[bool] = False

@router.post("/register", response_model=FaceAuthResponse)
async def register_face(
    user_id: str = Form(...),
    face_image: UploadFile = File(...),
    override_existing: bool = Form(False)
):
    """
    Register a user's face for future authentication
    """
    try:
        # Check if user exists in MongoDB
        collection = await mongo_client.get_collection("users")
        user = await collection.find_one({"_id": ObjectId(user_id)})
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        # Check if user already has face data
        face_data_collection = await mongo_client.get_collection("faceAuthData")
        existing_face = await face_data_collection.find_one({"userId": ObjectId(user_id)})
        
        if existing_face and not override_existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User already has registered face data. Use override_existing=true to replace."
            )
            
        # Save uploaded image temporarily
        temp_image_path = os.path.join(settings.TEMP_PATH, f"{uuid.uuid4()}.jpg")
        
        async with aiofiles.open(temp_image_path, "wb") as temp_file:
            content = await face_image.read()
            await temp_file.write(content)
        
        # Extract face embedding
        face_encoding = await face_model.extract_face_encoding(temp_image_path)
        
        if not face_encoding:
            # Clean up temp file
            os.remove(temp_image_path)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No face detected in the image or multiple faces detected. Please provide a clear image with a single face."
            )
        
        # Store face data in MongoDB
        face_data = {
            "userId": ObjectId(user_id),
            "faceEncoding": face_encoding.tolist(),
            "createdAt": datetime.utcnow()
        }
        
        if existing_face:
            await face_data_collection.update_one(
                {"userId": ObjectId(user_id)},
                {"$set": face_data}
            )
        else:
            await face_data_collection.insert_one(face_data)
        
        # Clean up temp file
        os.remove(temp_image_path)
        
        return {
            "success": True,
            "message": "Face registered successfully",
            "user_id": user_id
        }
    
    except HTTPException as e:
        raise e
    except Exception as e:
        logger.error(f"Error registering face: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to register face: {str(e)}"
        )

@router.post("/authenticate", response_model=FaceAuthResponse)
async def authenticate_face(face_image: UploadFile = File(...)):
    """
    Authenticate a user based on their face
    """
    try:
        # Save uploaded image temporarily
        temp_image_path = os.path.join(settings.TEMP_PATH, f"{uuid.uuid4()}.jpg")
        
        async with aiofiles.open(temp_image_path, "wb") as temp_file:
            content = await face_image.read()
            await temp_file.write(content)
        
        # Extract face embedding from uploaded image
        face_encoding = await face_model.extract_face_encoding(temp_image_path)
        
        if not face_encoding:
            # Clean up temp file
            os.remove(temp_image_path)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No face detected in the image or multiple faces detected. Please provide a clear image with a single face."
            )
        
        # Retrieve all face encodings from database
        face_data_collection = await mongo_client.get_collection("faceAuthData")
        all_face_data = await face_data_collection.find({}).to_list(length=None)
        
        if not all_face_data:
            os.remove(temp_image_path)
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No registered faces found in the database"
            )
        
        # Find best match
        best_match_user_id = None
        best_match_confidence = 0.0
        threshold = 0.6  # Confidence threshold for a match
        
        for face_data in all_face_data:
            stored_encoding = np.array(face_data["faceEncoding"])
            confidence = await face_model.compare_faces(face_encoding, stored_encoding)
            
            if confidence > threshold and confidence > best_match_confidence:
                best_match_confidence = confidence
                best_match_user_id = str(face_data["userId"])
        
        # Clean up temp file
        os.remove(temp_image_path)
        
        if best_match_user_id:
            # Log successful authentication
            await mongo_client.insert_one("aiAssistantLogs", {
                "userId": ObjectId(best_match_user_id),
                "intentType": "face_auth",
                "query": "Face authentication",
                "response": "Authentication successful",
                "responseTime": 0,  # You can calculate actual response time
                "createdAt": datetime.utcnow()
            })
            
            return {
                "success": True,
                "message": "Authentication successful",
                "user_id": best_match_user_id,
                "confidence": float(best_match_confidence)
            }
        else:
            return {
                "success": False,
                "message": "Authentication failed. No matching face found.",
                "confidence": 0.0
            }
    
    except HTTPException as e:
        raise e
    except Exception as e:
        logger.error(f"Error authenticating face: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to authenticate face: {str(e)}"
        )

@router.delete("/user/{user_id}")
async def delete_face_data(user_id: str):
    """
    Delete a user's face data
    """
    try:
        # Check if user exists
        collection = await mongo_client.get_collection("users")
        user = await collection.find_one({"_id": ObjectId(user_id)})
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        # Delete face data
        face_data_collection = await mongo_client.get_collection("faceAuthData")
        result = await face_data_collection.delete_one({"userId": ObjectId(user_id)})
        
        if result.deleted_count == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No face data found for this user"
            )
        
        return {
            "success": True,
            "message": "Face data deleted successfully"
        }
    
    except HTTPException as e:
        raise e
    except Exception as e:
        logger.error(f"Error deleting face data: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete face data: {str(e)}"
        )
