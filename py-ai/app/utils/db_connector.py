import motor.motor_asyncio
import logging
from pymongo.errors import ConnectionFailure, ServerSelectionTimeoutError
from app.config import settings
from typing import Any, Dict, List, Optional, Union

logger = logging.getLogger(__name__)

class AsyncMongoClient:
    _instance = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(AsyncMongoClient, cls).__new__(cls)
            cls._instance.client = None
            cls._instance.db = None
            cls._instance.initialized = False
        return cls._instance
    
    async def connect(self):
        """Initialize connection to MongoDB"""
        if self.initialized:
            return
            
        try:
            self.client = motor.motor_asyncio.AsyncIOMotorClient(
                settings.MONGODB_URI,
                serverSelectionTimeoutMS=5000
            )
            
            # Ping the server to check connection
            await self.client.admin.command('ping')
            
            # Let the driver parse the database, including URI query options.
            self.db = self.client.get_default_database()
            
            self.initialized = True
            logger.info(f"Connected to MongoDB database: {self.db.name}")
            
        except (ConnectionFailure, ServerSelectionTimeoutError) as e:
            logger.error(f"Failed to connect to MongoDB: {str(e)}")
            raise
    
    async def close(self):
        """Close the MongoDB connection"""
        if self.client is not None:
            self.client.close()
            self.client = None
            self.db = None
            self.initialized = False
            logger.info("MongoDB connection closed")
    
    async def get_collection(self, collection_name: str):
        """Get a collection from the database"""
        if not self.initialized:
            await self.connect()
        return self.db[collection_name]

    async def find_one(self, collection: str, query: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Find a single document in the collection"""
        collection = await self.get_collection(collection)
        return await collection.find_one(query)
    
    async def find_many(
        self, 
        collection: str, 
        query: Dict[str, Any], 
        projection: Optional[Dict[str, Any]] = None,
        sort: Optional[List[tuple]] = None,
        limit: Optional[int] = None,
        skip: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        """Find multiple documents in the collection"""
        collection = await self.get_collection(collection)
        cursor = collection.find(query, projection)
        
        if sort:
            cursor = cursor.sort(sort)
        
        if skip:
            cursor = cursor.skip(skip)
            
        if limit:
            cursor = cursor.limit(limit)
            
        return await cursor.to_list(length=None)
    
    async def insert_one(self, collection: str, document: Dict[str, Any]) -> str:
        """Insert a document into the collection"""
        collection = await self.get_collection(collection)
        result = await collection.insert_one(document)
        return str(result.inserted_id)
    
    async def insert_many(self, collection: str, documents: List[Dict[str, Any]]) -> List[str]:
        """Insert multiple documents into the collection"""
        collection = await self.get_collection(collection)
        result = await collection.insert_many(documents)
        return [str(id) for id in result.inserted_ids]
    
    async def update_one(
        self, 
        collection: str, 
        query: Dict[str, Any], 
        update: Dict[str, Any],
        upsert: bool = False
    ) -> int:
        """Update a document in the collection"""
        collection = await self.get_collection(collection)
        result = await collection.update_one(query, update, upsert=upsert)
        return result.modified_count
    
    async def update_many(
        self, 
        collection: str, 
        query: Dict[str, Any], 
        update: Dict[str, Any]
    ) -> int:
        """Update multiple documents in the collection"""
        collection = await self.get_collection(collection)
        result = await collection.update_many(query, update)
        return result.modified_count
    
    async def delete_one(self, collection: str, query: Dict[str, Any]) -> int:
        """Delete a document from the collection"""
        collection = await self.get_collection(collection)
        result = await collection.delete_one(query)
        return result.deleted_count
    
    async def delete_many(self, collection: str, query: Dict[str, Any]) -> int:
        """Delete multiple documents from the collection"""
        collection = await self.get_collection(collection)
        result = await collection.delete_many(query)
        return result.deleted_count
    
    async def count_documents(self, collection: str, query: Dict[str, Any]) -> int:
        """Count documents in the collection"""
        collection = await self.get_collection(collection)
        return await collection.count_documents(query)
    
    async def aggregate(self, collection: str, pipeline: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Run an aggregation pipeline on the collection"""
        collection = await self.get_collection(collection)
        cursor = collection.aggregate(pipeline)
        return await cursor.to_list(length=None)

# Create a singleton instance
mongo_client = AsyncMongoClient()
