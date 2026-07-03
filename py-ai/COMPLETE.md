# Báo cáo Hoàn thành — Tasks 1, 2, 3 (py-ai backlog)

**Ngày thực hiện:** 2026-06-28
**Người thực hiện:** Nguyễn Tấn Phát (với Claude Opus 4.8)
**Dự án:** kitchen_e / py-ai (FastAPI AI Service)
**Nguồn task:** `py-ai/ANALYSIS_REPORT.md` — mục 6, "Ưu tiên CAO" (Task 1, 2, 3)
**Trạng thái:** Hoàn thành — chờ review

---

## 1. Tóm tắt

Đã thực hiện 3 task ưu tiên cao từ backlog, viết test cho cả 3, và chạy toàn bộ test suite thành công (64/64 passed). Trong quá trình làm Task 3 đã phát hiện một vấn đề **nghiêm trọng hơn mô tả trong báo cáo gốc** (xem mục 4) và đã xử lý đúng gốc rễ.

---

## 2. Task 1 & 2 — Tích hợp Google Cloud Speech-to-Text & Text-to-Speech

**File:** `app/models/speech_recognition.py` (viết lại toàn bộ)

### Thay đổi
| Hàm | Trước | Sau |
|---|---|---|
| `recognize_speech()` | Trả text giả cố định, confidence tính theo kích thước file | Gọi Google Cloud Speech-to-Text thật (`SpeechClient.recognize`), trả transcript + confidence + language thực |
| `text_to_speech()` | Sinh sóng sine 440Hz giả qua torchaudio | Gọi Google Cloud TTS thật (`TextToSpeechClient.synthesize_speech`), trả MP3 thực |
| `detect_language()` | Luôn trả `"vi"` | Dùng `alternative_language_codes` của Speech-to-Text để phát hiện ngôn ngữ thật (bonus — Task #10) |
| `list_voices()` | Chỉ trả cache tĩnh | Ưu tiên danh sách voice live từ cloud, fallback về cache |

### Quyết định thiết kế
- **Import lười (lazy import)** `google.cloud.speech` / `google.cloud.texttospeech`: module vẫn import được trong môi trường không cài SDK / không có credentials. Khi gọi hàm mà chưa cấu hình → raise `RuntimeError` với thông báo rõ ràng thay vì crash khó hiểu.
- **Chạy SDK blocking trong ThreadPoolExecutor**: các call của Google SDK là đồng bộ; bọc qua `loop.run_in_executor` để không block event loop của FastAPI.
- **Chuẩn hóa mã ngôn ngữ**: thêm helper `_to_bcp47` / `_from_bcp47` để map `vi` ↔ `vi-VN`, `en` ↔ `en-US`.
- Bỏ phụ thuộc `torch` / `torchaudio` khỏi luồng speech (không còn cần sinh sóng giả).

### Cập nhật dependencies
`requirements.txt` — thêm (pinned):
```
google-cloud-speech==2.21.0
google-cloud-texttospeech==2.14.1
```

> **Lưu ý vận hành:** Để hoạt động thật trong production cần set biến môi trường `GOOGLE_APPLICATION_CREDENTIALS` trỏ tới service-account JSON có quyền Speech-to-Text và Text-to-Speech. Khi chưa cấu hình, các endpoint speech sẽ trả lỗi rõ ràng (RuntimeError) — không trả dữ liệu giả nữa.

---

## 3. Task 3 — Fix lỗi import module recommendation

**File:** `app/models/recommendation.py`, `app/api/recipe_recommendation.py`

### Trạng thái cuối
- `app/models/recommendation.py` → chứa đúng class `RecommendationEngine`, **không còn dòng self-import**.
- `app/api/recipe_recommendation.py` → chứa đúng recipe router (`APIRouter`), **không còn import thừa** `RecommendationEngine` và biến `recommendation_engine` không dùng tới.
- `app/api/product_recommendation.py` (line 6) và `app/main.py` (line 49) giờ resolve import chính xác.

---

## 4. ⚠️ Phát hiện quan trọng: báo cáo gốc mô tả Task 3 chưa chính xác

Báo cáo gốc nói `app/models/recommendation.py` "định nghĩa class `RecommendationEngine`" và chỉ cần xóa dòng self-import (dòng 6). **Thực tế không phải vậy** — nội dung hai file đã bị **hoán đổi cho nhau**:

| File | Theo tên file (kỳ vọng) | Nội dung thực tế TRƯỚC khi fix |
|---|---|---|
| `app/models/recommendation.py` | class `RecommendationEngine` | **recipe router** + dòng self-import bị lỗi |
| `app/api/recipe_recommendation.py` | recipe router | **class `RecommendationEngine`** (không có router) |

Hệ quả: nếu chỉ xóa dòng 6 như báo cáo đề xuất thì:
- Dòng 14 `recommendation_engine = RecommendationEngine()` sẽ hỏng (NameError).
- `main.py` line 49 `recipe_recommendation.router` sẽ hỏng (file đó không có `router`).
- `product_recommendation.py` line 6 import `RecommendationEngine` từ `app.models.recommendation` cũng hỏng.

→ **App không thể khởi động.** Đây là lỗi production thật sự, lớn hơn mô tả gốc.

### Cách fix đã chọn
Hoán đổi lại nội dung hai file về đúng tên (khớp với cách `main.py` đã wire sẵn), rồi xóa dòng self-import và biến global thừa. Đây là fix đúng gốc rễ thay vì vá tạm.

---

## 5. Test

**File mới:** `tests/test_speech_and_recommendation_fix.py` (16 test)

| Nhóm | Test | Kiểm tra |
|---|---|---|
| TestRecognizeSpeech | test_transcribes_audio_via_cloud_client | Gọi cloud client, trả transcript/confidence/language đúng, dùng BCP-47 `vi-VN` |
| TestRecognizeSpeech | test_missing_file_returns_none | File không tồn tại → None |
| TestRecognizeSpeech | test_no_results_returns_none | Cloud trả rỗng → None |
| TestRecognizeSpeech | test_raises_when_cloud_not_configured | Chưa cấu hình SDK → RuntimeError |
| TestTextToSpeech | test_synthesizes_audio_via_cloud_client | Gọi TTS, trả MP3 bytes, đúng voice/language/encoding |
| TestTextToSpeech | test_empty_text_raises | Text rỗng → ValueError |
| TestTextToSpeech | test_raises_when_cloud_not_configured | Chưa cấu hình SDK → RuntimeError |
| TestLanguageHelpers | test_language_code_mapping | Map `vi`↔`vi-VN`, `en`↔`en-US` |
| TestLanguageHelpers | test_detect_language_returns_detected_code | Phát hiện `en-US` → trả `en` |
| TestLanguageHelpers | test_detect_language_falls_back_without_client | Không có client → fallback `vi` |
| TestRecommendationImportFix | test_engine_module_defines_engine | models/recommendation.py có class `RecommendationEngine` |
| TestRecommendationImportFix | test_engine_module_has_no_self_import | Không còn self-import |
| TestRecommendationImportFix | test_recipe_router_module_defines_router | recipe_recommendation.py có `router`, không có class engine |
| TestRecommendationImportFix | test_recipe_router_has_no_dead_engine_import | Không còn import/biến thừa |
| TestRecommendationImportFix | test_product_router_imports_engine_from_models | product router import engine đúng chỗ |
| TestRecommendationImportFix | test_recipe_router_imports_cleanly | recipe router import được, không ImportError |

**Ghi chú kỹ thuật về test speech:** `conftest.py` mock toàn bộ module `app.models.speech_recognition` cho các test khác. Test mới cần bản *thật*, nên nó load trực tiếp source bằng `importlib` và inject fake `google.cloud` SDK — không cần cài torch/google-cloud trong môi trường test.

**Sửa conftest:** thêm `DEFAULT_LANGUAGE="vi"` vào fake settings (thuộc tính này có thật trong `app/config.py`, code mới có dùng).

### Kết quả chạy test
```
python -m pytest -q
................................................................   [100%]
64 passed in 2.57s
```
(48 test cũ vẫn pass + 16 test mới)

---

## 6. Danh sách file thay đổi

| File | Loại | Mô tả |
|---|---|---|
| `app/models/speech_recognition.py` | Viết lại | Tích hợp Google Cloud STT/TTS thật (Task 1, 2) + detect_language thật |
| `app/models/recommendation.py` | Sửa nội dung | Khôi phục đúng class `RecommendationEngine` (Task 3) |
| `app/api/recipe_recommendation.py` | Sửa nội dung | Khôi phục đúng recipe router, bỏ import/biến thừa (Task 3) |
| `requirements.txt` | Thêm dep | google-cloud-speech, google-cloud-texttospeech |
| `tests/test_speech_and_recommendation_fix.py` | Tạo mới | 16 test cho Task 1, 2, 3 |
| `tests/conftest.py` | Sửa | Thêm `DEFAULT_LANGUAGE` vào fake settings |

---

## 7. Việc cần review / quyết định

1. **Phiên bản SDK Google Cloud** (`2.21.0` / `2.14.1`) — chọn theo bản ổn định phổ biến; cần xác nhận tương thích với môi trường deploy.
2. **Credentials production** — cần cung cấp `GOOGLE_APPLICATION_CREDENTIALS`; chưa có trong repo (đúng, không nên commit secret).
3. **Hành vi khi chưa cấu hình cloud** — hiện raise `RuntimeError`. Nếu muốn graceful degradation (vd trả 503) thì cần chỉnh thêm ở tầng API `app/api/speech.py`.
4. **Xác nhận** việc hoán đổi nội dung 2 file recommendation là đúng ý đồ kiến trúc (mục 4) — đã đối chiếu với cách `main.py` wire router nên tin là đúng, nhưng cần review xác nhận.

---

*Phần trên (Task 1, 2, 3) — đợt 1, đã chờ review.*

---
---

# Báo cáo Hoàn thành — Đợt 2: Tasks 4–11 (toàn bộ backlog còn lại)

**Ngày thực hiện:** 2026-06-28
**Người thực hiện:** Nguyễn Tấn Phát (với Claude Opus 4.8)
**Trạng thái:** Hoàn thành — chờ review

## 8. Tóm tắt đợt 2

Thực hiện nốt toàn bộ task còn lại trong backlog (mục 6 báo cáo gốc): ưu tiên TRUNG BÌNH (4, 5, 6, 7) và ưu tiên THẤP (8, 9, 10, 11). Viết test cho tất cả phần code mới. Toàn bộ suite hiện **107 passed + 5 skipped** (5 skip là integration test cần MongoDB thật).

| # | Task | Trạng thái |
|---|---|---|
| 4 | Thêm NER vào `chat_model.py` | ✅ Hoàn thành |
| 5 | Recipe recommendation dùng semantic similarity | ✅ Hoàn thành |
| 6 | Test cho `api/user_behavior.py` | ✅ 17 test |
| 7 | Test cho `api/recipe_recommendation.py` | ✅ 16 test |
| 8 | Mở rộng conversation context window | ✅ Hoàn thành |
| 9 | Integration test với MongoDB | ✅ Scaffold (skip nếu không có DB) |
| 10 | `detect_language()` thật | ✅ Đã làm trong đợt 1 (bonus) |
| 11 | Cập nhật `requirements.txt` | ✅ `python-multipart` đã có sẵn |

## 9. Chi tiết từng task

### Task 4 — NER (Named Entity Recognition)
**File:** `app/models/chat_model.py`

Thêm method `extract_entities(text)` kết hợp 3 nguồn:
1. **underthesea NER** (optional, lazy import) — trích PERSON / LOCATION / ORG.
2. **Domain dictionary** — loại sản phẩm (nồi, chảo, dao, máy xay…) và chất liệu (inox, gang, chống dính…).
3. **Regex** — số lượng (`2 cái`, `3 chiếc`) và giá (`200k`, `1 triệu`, `150000 vnd`).

`generate_response()` giờ trả thêm field `entities`. Khi không cài underthesea, NER fallback im lặng — dictionary + regex vẫn chạy.

### Task 8 — Context window
**File:** `app/models/chat_model.py`, `app/api/chat.py`

- Thêm `_trim_history()` cắt history theo `settings.MAX_CONVERSATION_HISTORY` (đơn vị: lượt = cặp user/assistant → giữ tối đa 2x message gần nhất).
- `app/api/chat.py`: thay hardcode `limit=10` bằng `settings.MAX_CONVERSATION_HISTORY` (config-driven, có thể chỉnh qua env var).

### Task 5 — Semantic similarity cho recipe
**File:** `app/api/recipe_recommendation.py`

- Thêm helper `get_recipes_by_semantic_search()` dùng PhoBERT embedding (`ProductEmbeddingModel`, lazy import) xếp hạng recipe theo cosine similarity với query — cùng kỹ thuật như product recommendation.
- Fallback về text-search (substring trên title/description) khi embedding model không khả dụng → endpoint luôn trả kết quả dùng được.
- Thêm field `query` vào `RecipeRecommendationRequest` và endpoint mới `GET /recipes/search`.

### Task 6 & 7 — Test
- `tests/test_user_behavior.py` — 17 test: log-activity, insights (cache/generate/404), segments, popular-products, product-affinity, search-trends, và các helper thuần.
- `tests/test_recipe_recommendation.py` — 16 test: dispatch đa chiến lược, popular/search endpoint, feedback (success/404), và unit test cho semantic search (ranking + fallback + empty).

### Task 9 — Integration test MongoDB
**File:** `tests/test_integration_mongo.py`

Scaffold CRUD + aggregate chạy với MongoDB thật. **Skip** trừ khi set `MONGODB_TEST_URI`. Dùng collection riêng `_integration_test_products`, drop sạch trước/sau mỗi test → không đụng dữ liệu production. Có hướng dẫn chạy (docker container) trong docstring.

### Task 10 & 11
- **Task 10:** `detect_language()` thật đã làm trong đợt 1 (dùng `alternative_language_codes` của Google STT).
- **Task 11:** `python-multipart==0.0.6` đã có sẵn trong `requirements.txt` (dòng 7).

## 10. File thay đổi (đợt 2)

| File | Loại | Mô tả |
|---|---|---|
| `app/models/chat_model.py` | Sửa | Thêm `extract_entities()` (NER), `_trim_history()`, entities vào response |
| `app/api/chat.py` | Sửa | History limit dùng `settings.MAX_CONVERSATION_HISTORY` |
| `app/api/recipe_recommendation.py` | Sửa | Semantic search helper + endpoint `/search` + field `query` |
| `tests/test_user_behavior.py` | Tạo mới | 17 test |
| `tests/test_recipe_recommendation.py` | Tạo mới | 16 test |
| `tests/test_chat_model_nlp.py` | Tạo mới | 17 test (NER + context window) |
| `tests/test_integration_mongo.py` | Tạo mới | 5 test integration (skip nếu không có DB) |
| `tests/conftest.py` | Sửa | Thêm `MAX_CONVERSATION_HISTORY`, mock `pandas` + `aiohttp` |

## 11. Kết quả test (đợt 2)

```
python -m pytest -q
107 passed, 5 skipped in 1.96s
```

## 12. Lưu ý / cần review (đợt 2)

1. **underthesea** chưa có trong `requirements.txt` — NER hoạt động ở chế độ dictionary+regex nếu chưa cài. Nếu muốn dùng NER đầy đủ cần thêm `underthesea` vào requirements (chưa thêm vì là dependency nặng, để bạn quyết định).
2. **Semantic recipe search** embed từng recipe mỗi request (chưa cache embedding như product). Với catalog lớn nên thêm cache embedding sau — hiện đủ dùng và có fallback.
3. **`import pandas`/`import aiohttp`** trong `user_behavior.py`/`chat_model.py` là import thừa (không dùng). Đã mock trong test; có thể xóa khỏi source nếu muốn (chưa xóa để giữ thay đổi tối thiểu).
4. **Integration test** cần MongoDB; mặc định skip. Khuyến nghị thêm vào CI một job có mongo service để chạy nhóm này.

---

*Dừng lại tại đây chờ review.*

