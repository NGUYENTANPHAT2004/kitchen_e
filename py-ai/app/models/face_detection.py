from __future__ import annotations
try:
    import cv2
    import dlib
    import numpy as np
    _CV_AVAILABLE = True
except ImportError:
    cv2 = None
    dlib = None
    np = None
    _CV_AVAILABLE = False
import os
import logging
from app.config import settings
from typing import List, Tuple, Optional, Union
import asyncio
from concurrent.futures import ThreadPoolExecutor

logger = logging.getLogger(__name__)

class FaceRecognitionModel:
    _instance = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(FaceRecognitionModel, cls).__new__(cls)
            cls._instance.initialized = False
        return cls._instance
    
    async def initialize(self):
        """Initialize face recognition models lazily"""
        if self.initialized:
            return
            
        try:
            # Initialize in a thread pool to avoid blocking the event loop
            loop = asyncio.get_event_loop()
            with ThreadPoolExecutor() as pool:
                await loop.run_in_executor(pool, self._load_models)
                
            self.initialized = True
            logger.info("Face recognition models loaded successfully")
        except Exception as e:
            logger.error(f"Failed to initialize face recognition models: {str(e)}")
            raise
    
    def _load_models(self):
        """Load dlib models for face detection and recognition"""
        # Face detector using HOG + SVM
        self.face_detector = dlib.get_frontal_face_detector()
        
        # Load facial landmark predictor
        landmark_path = settings.FACE_LANDMARK_MODEL
        if not os.path.exists(landmark_path):
            raise FileNotFoundError(f"Facial landmark model not found at {landmark_path}")
        self.shape_predictor = dlib.shape_predictor(landmark_path)
        
        # Load face recognition model
        recognition_path = settings.FACE_RECOGNITION_MODEL
        if not os.path.exists(recognition_path):
            raise FileNotFoundError(f"Face recognition model not found at {recognition_path}")
        self.face_recognizer = dlib.face_recognition_model_v1(recognition_path)
    
    async def extract_face_encoding(self, image_path: str) -> Optional[np.ndarray]:
        """Extract face encoding from an image file"""
        await self.initialize()
        
        try:
            # Run in thread pool to avoid blocking
            loop = asyncio.get_event_loop()
            with ThreadPoolExecutor() as pool:
                return await loop.run_in_executor(pool, self._extract_face_encoding_sync, image_path)
        except Exception as e:
            logger.error(f"Error extracting face encoding: {str(e)}")
            return None
    
    def _extract_face_encoding_sync(self, image_path: str) -> Optional[np.ndarray]:
        """Synchronous implementation of face encoding extraction"""
        # Load image
        img = cv2.imread(image_path)
        if img is None:
            logger.error(f"Failed to load image from {image_path}")
            return None
            
        # Convert BGR to RGB (dlib uses RGB)
        rgb_img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        
        # Detect faces
        faces = self.face_detector(rgb_img, 1)
        
        if len(faces) != 1:
            logger.warning(f"Expected 1 face, found {len(faces)} in {image_path}")
            return None
            
        # Get facial landmarks
        shape = self.shape_predictor(rgb_img, faces[0])
        
        # Compute face encoding
        face_encoding = np.array(self.face_recognizer.compute_face_descriptor(rgb_img, shape))
        
        return face_encoding
    
    async def compare_faces(self, face_encoding1: np.ndarray, face_encoding2: np.ndarray) -> float:
        """Compare two face encodings and return similarity score (0-1)"""
        await self.initialize()
        
        try:
            # Calculate Euclidean distance
            distance = np.linalg.norm(face_encoding1 - face_encoding2)
            
            # Convert to similarity score (0-1)
            # Lower distance means higher similarity
            # Typical threshold is around 0.6 for dlib's 128D face encodings
            similarity = 1.0 / (1.0 + distance)
            
            return similarity
        except Exception as e:
            logger.error(f"Error comparing faces: {str(e)}")
            return 0.0
    
    async def detect_faces(self, image_path: str) -> List[Tuple[int, int, int, int]]:
        """Detect faces in an image and return their bounding boxes"""
        await self.initialize()
        
        try:
            # Run in thread pool to avoid blocking
            loop = asyncio.get_event_loop()
            with ThreadPoolExecutor() as pool:
                return await loop.run_in_executor(pool, self._detect_faces_sync, image_path)
        except Exception as e:
            logger.error(f"Error detecting faces: {str(e)}")
            return []
    
    def _detect_faces_sync(self, image_path: str) -> List[Tuple[int, int, int, int]]:
        """Synchronous implementation of face detection"""
        # Load image
        img = cv2.imread(image_path)
        if img is None:
            logger.error(f"Failed to load image from {image_path}")
            return []
            
        # Convert BGR to RGB (dlib uses RGB)
        rgb_img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        
        # Detect faces
        faces = self.face_detector(rgb_img, 1)
        
        # Convert dlib rectangles to (x, y, w, h) format
        face_boxes = []
        for face in faces:
            x = face.left()
            y = face.top()
            w = face.right() - face.left()
            h = face.bottom() - face.top()
            face_boxes.append((x, y, w, h))
        
        return face_boxes
    
    async def align_face(self, image_path: str, face_location: Tuple[int, int, int, int]) -> Optional[np.ndarray]:
        """Align a face based on facial landmarks for improved recognition"""
        await self.initialize()
        
        try:
            # Run in thread pool to avoid blocking
            loop = asyncio.get_event_loop()
            with ThreadPoolExecutor() as pool:
                return await loop.run_in_executor(
                    pool, 
                    self._align_face_sync, 
                    image_path, 
                    face_location
                )
        except Exception as e:
            logger.error(f"Error aligning face: {str(e)}")
            return None
    
    def _align_face_sync(self, image_path: str, face_location: Tuple[int, int, int, int]) -> Optional[np.ndarray]:
        """Synchronous implementation of face alignment"""
        # Load image
        img = cv2.imread(image_path)
        if img is None:
            logger.error(f"Failed to load image from {image_path}")
            return None
            
        # Convert BGR to RGB (dlib uses RGB)
        rgb_img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        
        # Convert (x, y, w, h) to dlib rectangle
        x, y, w, h = face_location
        rect = dlib.rectangle(x, y, x + w, y + h)
        
        # Get facial landmarks
        shape = self.shape_predictor(rgb_img, rect)
        
        # Convert landmarks to numpy array
        landmarks = np.array([[p.x, p.y] for p in shape.parts()])
        
        # Calculate center of eyes
        left_eye_center = landmarks[36:42].mean(axis=0)
        right_eye_center = landmarks[42:48].mean(axis=0)
        
        # Calculate angle between eyes
        dx = right_eye_center[0] - left_eye_center[0]
        dy = right_eye_center[1] - left_eye_center[1]
        angle = np.degrees(np.arctan2(dy, dx))
        
        # Calculate center between eyes
        eyes_center = (left_eye_center + right_eye_center) / 2
        
        # Get rotation matrix
        M = cv2.getRotationMatrix2D(tuple(eyes_center), angle, 1)
        
        # Apply affine transformation
        aligned_face = cv2.warpAffine(rgb_img, M, (rgb_img.shape[1], rgb_img.shape[0]))
        
        # Convert back to BGR for OpenCV
        aligned_face = cv2.cvtColor(aligned_face, cv2.COLOR_RGB2BGR)
        
        return aligned_face