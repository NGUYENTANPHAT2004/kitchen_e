import pytest
import io
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi.testclient import TestClient
from fastapi import FastAPI

# ---------------------------------------------------------------------------
# App fixture – chỉ mount router face_auth để tránh load heavy ML models
# ---------------------------------------------------------------------------

@pytest.fixture(scope="module")
def app():
    from app.api.face_auth import router
    _app = FastAPI()
    _app.include_router(router, prefix="/face-auth")
    return _app

@pytest.fixture(scope="module")
def client(app):
    return TestClient(app)

def _fake_image():
    return ("face_image", ("test.jpg", io.BytesIO(b"fake-image-data"), "image/jpeg"))

VALID_OID = "64b1234567890abcdef12345"


# ---------------------------------------------------------------------------
# POST /face-auth/register
# ---------------------------------------------------------------------------

class TestRegisterFace:
    def test_user_not_found_returns_404(self, client):
        with patch("app.api.face_auth.mongo_client") as mock_db:
            col_mock = AsyncMock()
            col_mock.find_one = AsyncMock(return_value=None)
            mock_db.get_collection = AsyncMock(return_value=col_mock)

            resp = client.post(
                "/face-auth/register",
                data={"user_id": VALID_OID, "override_existing": "false"},
                files=[_fake_image()],
            )
        assert resp.status_code == 404
        assert "User not found" in resp.json()["detail"]

    def test_duplicate_face_without_override_returns_400(self, client):
        with patch("app.api.face_auth.mongo_client") as mock_db:
            user_col = AsyncMock()
            user_col.find_one = AsyncMock(return_value={"_id": VALID_OID})
            face_col = AsyncMock()
            face_col.find_one = AsyncMock(return_value={"userId": VALID_OID})
            mock_db.get_collection = AsyncMock(side_effect=[user_col, face_col])

            resp = client.post(
                "/face-auth/register",
                data={"user_id": VALID_OID, "override_existing": "false"},
                files=[_fake_image()],
            )
        assert resp.status_code == 400
        assert "already has registered" in resp.json()["detail"]

    def test_no_face_detected_returns_400(self, client):
        with (
            patch("app.api.face_auth.mongo_client") as mock_db,
            patch("app.api.face_auth.face_model") as mock_model,
            patch("app.api.face_auth.aiofiles.open"),
            patch("app.api.face_auth.os.remove"),
        ):
            user_col = AsyncMock()
            user_col.find_one = AsyncMock(return_value={"_id": VALID_OID})
            face_col = AsyncMock()
            face_col.find_one = AsyncMock(return_value=None)
            mock_db.get_collection = AsyncMock(side_effect=[user_col, face_col])
            mock_model.extract_face_encoding = AsyncMock(return_value=None)

            resp = client.post(
                "/face-auth/register",
                data={"user_id": VALID_OID, "override_existing": "false"},
                files=[_fake_image()],
            )
        assert resp.status_code == 400
        assert "No face detected" in resp.json()["detail"]

    def test_register_success(self, client):
        import numpy as np
        fake_encoding = np.zeros(128)

        with (
            patch("app.api.face_auth.mongo_client") as mock_db,
            patch("app.api.face_auth.face_model") as mock_model,
            patch("app.api.face_auth.aiofiles.open"),
            patch("app.api.face_auth.os.remove"),
        ):
            user_col = AsyncMock()
            user_col.find_one = AsyncMock(return_value={"_id": VALID_OID})
            face_col = AsyncMock()
            face_col.find_one = AsyncMock(return_value=None)
            face_col.insert_one = AsyncMock(return_value=MagicMock())
            mock_db.get_collection = AsyncMock(side_effect=[user_col, face_col])
            mock_model.extract_face_encoding = AsyncMock(return_value=fake_encoding)

            resp = client.post(
                "/face-auth/register",
                data={"user_id": VALID_OID, "override_existing": "false"},
                files=[_fake_image()],
            )
        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True
        assert body["user_id"] == VALID_OID

    def test_register_override_calls_update(self, client):
        import numpy as np
        fake_encoding = np.zeros(128)

        with (
            patch("app.api.face_auth.mongo_client") as mock_db,
            patch("app.api.face_auth.face_model") as mock_model,
            patch("app.api.face_auth.aiofiles.open"),
            patch("app.api.face_auth.os.remove"),
        ):
            user_col = AsyncMock()
            user_col.find_one = AsyncMock(return_value={"_id": VALID_OID})
            face_col = AsyncMock()
            face_col.find_one = AsyncMock(return_value={"userId": VALID_OID})
            face_col.update_one = AsyncMock(return_value=MagicMock())
            mock_db.get_collection = AsyncMock(side_effect=[user_col, face_col])
            mock_model.extract_face_encoding = AsyncMock(return_value=fake_encoding)

            resp = client.post(
                "/face-auth/register",
                data={"user_id": VALID_OID, "override_existing": "true"},
                files=[_fake_image()],
            )
        assert resp.status_code == 200
        assert resp.json()["success"] is True


# ---------------------------------------------------------------------------
# POST /face-auth/authenticate
# ---------------------------------------------------------------------------

class TestAuthenticateFace:
    def test_no_face_detected_returns_400(self, client):
        with (
            patch("app.api.face_auth.face_model") as mock_model,
            patch("app.api.face_auth.aiofiles.open"),
            patch("app.api.face_auth.os.remove"),
        ):
            mock_model.extract_face_encoding = AsyncMock(return_value=None)

            resp = client.post("/face-auth/authenticate", files=[_fake_image()])
        assert resp.status_code == 400
        assert "No face detected" in resp.json()["detail"]

    def test_no_registered_faces_returns_404(self, client):
        import numpy as np

        with (
            patch("app.api.face_auth.face_model") as mock_model,
            patch("app.api.face_auth.mongo_client") as mock_db,
            patch("app.api.face_auth.aiofiles.open"),
            patch("app.api.face_auth.os.remove"),
        ):
            mock_model.extract_face_encoding = AsyncMock(return_value=np.zeros(128))
            face_col = AsyncMock()
            cursor = MagicMock()
            cursor.to_list = AsyncMock(return_value=[])
            face_col.find = MagicMock(return_value=cursor)
            mock_db.get_collection = AsyncMock(return_value=face_col)

            resp = client.post("/face-auth/authenticate", files=[_fake_image()])
        assert resp.status_code == 404
        assert "No registered faces" in resp.json()["detail"]

    def test_authenticate_success_above_threshold(self, client):
        import numpy as np

        with (
            patch("app.api.face_auth.face_model") as mock_model,
            patch("app.api.face_auth.mongo_client") as mock_db,
            patch("app.api.face_auth.aiofiles.open"),
            patch("app.api.face_auth.os.remove"),
        ):
            mock_model.extract_face_encoding = AsyncMock(return_value=np.zeros(128))
            mock_model.compare_faces = AsyncMock(return_value=0.85)

            face_col = AsyncMock()
            cursor = MagicMock()
            cursor.to_list = AsyncMock(return_value=[
                {"userId": VALID_OID, "faceEncoding": np.zeros(128).tolist()}
            ])
            face_col.find = MagicMock(return_value=cursor)
            mock_db.get_collection = AsyncMock(return_value=face_col)
            mock_db.insert_one = AsyncMock()

            resp = client.post("/face-auth/authenticate", files=[_fake_image()])
        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True
        assert body["confidence"] == pytest.approx(0.85)

    def test_authenticate_no_match_below_threshold(self, client):
        import numpy as np

        with (
            patch("app.api.face_auth.face_model") as mock_model,
            patch("app.api.face_auth.mongo_client") as mock_db,
            patch("app.api.face_auth.aiofiles.open"),
            patch("app.api.face_auth.os.remove"),
        ):
            mock_model.extract_face_encoding = AsyncMock(return_value=np.zeros(128))
            mock_model.compare_faces = AsyncMock(return_value=0.3)

            face_col = AsyncMock()
            cursor = MagicMock()
            cursor.to_list = AsyncMock(return_value=[
                {"userId": VALID_OID, "faceEncoding": np.zeros(128).tolist()}
            ])
            face_col.find = MagicMock(return_value=cursor)
            mock_db.get_collection = AsyncMock(return_value=face_col)

            resp = client.post("/face-auth/authenticate", files=[_fake_image()])
        assert resp.status_code == 200
        assert resp.json()["success"] is False


# ---------------------------------------------------------------------------
# DELETE /face-auth/user/{user_id}
# ---------------------------------------------------------------------------

class TestDeleteFaceData:
    def test_user_not_found_returns_404(self, client):
        with patch("app.api.face_auth.mongo_client") as mock_db:
            col = AsyncMock()
            col.find_one = AsyncMock(return_value=None)
            mock_db.get_collection = AsyncMock(return_value=col)

            resp = client.delete(f"/face-auth/user/{VALID_OID}")
        assert resp.status_code == 404
        assert "User not found" in resp.json()["detail"]

    def test_no_face_data_returns_404(self, client):
        with patch("app.api.face_auth.mongo_client") as mock_db:
            user_col = AsyncMock()
            user_col.find_one = AsyncMock(return_value={"_id": VALID_OID})
            face_col = AsyncMock()
            result = MagicMock()
            result.deleted_count = 0
            face_col.delete_one = AsyncMock(return_value=result)
            mock_db.get_collection = AsyncMock(side_effect=[user_col, face_col])

            resp = client.delete(f"/face-auth/user/{VALID_OID}")
        assert resp.status_code == 404
        assert "No face data" in resp.json()["detail"]

    def test_delete_success(self, client):
        with patch("app.api.face_auth.mongo_client") as mock_db:
            user_col = AsyncMock()
            user_col.find_one = AsyncMock(return_value={"_id": VALID_OID})
            face_col = AsyncMock()
            result = MagicMock()
            result.deleted_count = 1
            face_col.delete_one = AsyncMock(return_value=result)
            mock_db.get_collection = AsyncMock(side_effect=[user_col, face_col])

            resp = client.delete(f"/face-auth/user/{VALID_OID}")
        assert resp.status_code == 200
        assert resp.json()["success"] is True


# ---------------------------------------------------------------------------
# Kiểm tra tính toàn vẹn import (phát hiện lỗi import cuối file)
# ---------------------------------------------------------------------------

class TestImportIntegrity:
    def test_face_auth_module_imports_without_name_error(self):
        """Import module phải thành công — NameError nếu datetime/numpy ở cuối file."""
        import sys
        for mod in list(sys.modules.keys()):
            if "face_auth" in mod:
                del sys.modules[mod]
        try:
            import app.api.face_auth  # noqa: F401
        except NameError as exc:
            pytest.fail(
                f"NameError khi import app.api.face_auth — "
                f"datetime hoặc numpy chưa import ở đầu file: {exc}"
            )

    def test_datetime_used_before_end_of_file(self):
        """datetime.utcnow() được gọi trong register_face (dòng ~82) — phải có trước dòng đó."""
        import ast, pathlib
        src = pathlib.Path("e:/kitchen_e/py-ai/app/api/face_auth.py").read_text(encoding="utf-8")
        tree = ast.parse(src)
        import_lines = []
        for node in ast.walk(tree):
            if isinstance(node, (ast.Import, ast.ImportFrom)):
                names = [alias.name for alias in node.names]
                if any("datetime" in n for n in names) or (
                    isinstance(node, ast.ImportFrom) and node.module and "datetime" in node.module
                ):
                    import_lines.append(node.lineno)
        assert import_lines, "Không tìm thấy import datetime trong file"
        assert min(import_lines) <= 20, (
            f"Import datetime ở dòng {min(import_lines)} — phải ở đầu file (≤ dòng 20)"
        )
