import hmac
from fastapi import Header, HTTPException
from app.config import settings


async def require_service_key(x_ai_service_key: str = Header(default="")):
    expected = getattr(settings, "AI_SERVICE_KEY", "")
    if not expected:
        raise HTTPException(503, "Chưa cấu hình khóa kết nối dịch vụ AI.")
    if not hmac.compare_digest(x_ai_service_key, expected):
        raise HTTPException(401, "Kết nối dịch vụ AI không được xác thực.")
