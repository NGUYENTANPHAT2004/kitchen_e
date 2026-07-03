# Danh sách Task — Phân tích tích hợp Frontend ↔ Backend (kitchen_e)

> Tài liệu này liệt kê các vấn đề tích hợp API giữa FE và BE, phân loại theo:
> - **A**: Đã có call API nhưng xử lý SAI (parse/mapping/endpoint sai).
> - **B**: Chưa có hàm call API (cần tạo mới).
> - **C**: Có API backend nhưng UI dùng mock data / chưa hiển thị dữ liệu thật.
> - **D**: Chưa có cả UI lẫn API (hoặc backend chưa có endpoint).
>
> Stack: BE = Node/Express + Mongoose. FE = React 19 + TS + **React Query v4.39** (KHÔNG dùng Redux), axios instance tại `fe/src/config/api_cli.config.ts`.
> Duyệt từng task, đánh dấu ✅/✏️/❌ ở cột Duyệt trước khi mình bắt tay sửa.

---

## 0. Phát hiện nền tảng (đọc trước — ảnh hưởng toàn bộ)

**F1. Response shape backend KHÔNG nhất quán** — *Ảnh hưởng mọi tầng parse*
Hầu hết API bọc `{ success, message, data }`. Trong đó `data` đa số có **key con** (`data.product`, `data.products`+`pagination`, `data.categories`, `data.user`, `data.order`, `data.orders`...). NHƯNG một số controller trả `data` **là object/mảng trực tiếp (bare)**:
- `vouchers` (getVoucher, create, update, **`/vouchers/public` → data LÀ MẢNG**)
- `reviews` (getReview, create, update, approve/reject/respond — bare)
- `flash-sales` (create, update, **`/active` → mảng**, status — bare)
- `notifications` (getNotification, markAsRead, dismiss, createFromTemplate — bare)
Ngoại lệ: `login`/`register`/`updatePassword` trả `{ success, token, user }` ở **top-level** (không qua wrapper).
→ **Khi nối API phải tra đúng shape từng endpoint.** Đây là gốc của phần lớn lỗi loại A bên dưới.

**F2. Routing-order bugs ở backend (param route nuốt literal route)** — *Ưu tiên CAO (chặn nhiều task FE)*
Các route literal khai báo SAU route `/:id` cùng method → Express match `/:id` trước, literal không gọi được:
- `GET /api/users/search`, `GET /api/users/stats` (bị `/:id` nuốt)
- `PUT /api/categories/reorder` (bị `PUT /:id` nuốt)
- `PUT /api/bundles/:bundleId/items/reorder`
- `GET /api/notifications/unread-count`, `DELETE /api/notifications/read`
→ FE không nên gọi các route này cho tới khi BE sắp xếp lại thứ tự. Cần sửa thứ tự khai báo route ở BE.

**F3. Không có refresh-token** — `endpoints.auth.refresh` khai báo trong config nhưng **BE không có route** `/auth/refresh`. Session check thực tế là `GET /auth/me`. Cần bỏ khai báo thừa hoặc làm rõ.

**F4. `endpoints` trong config thiếu nhóm** — chỉ khai báo `auth/categories/products/users`. **Thiếu `cart`, `orders`, `payments`, `vouchers`, `wishlist`, `reviews`, `notifications`, `flash-sales`, `bundles`, `recipes`**. Cần bổ sung khi nối các module tương ứng.

**F5. `vouchers.routes.js`** tham chiếu `ApiError` chưa import trong inline owner-guard → ném `ReferenceError` nếu non-owner truy cập. Cần import hoặc bỏ.

**F6. `GET /api/ai`** chỉ trả plain text `"GET AI"` — **KHÔNG có API AI thật** (logs/intents/analytics đều không tồn tại).

---

## 1. AUTH (Ưu tiên CAO — xương sống)

| # | File | Loại | Vấn đề | Đề xuất sửa | Duyệt |
|---|------|------|--------|-------------|-------|
| 1 | `features/auth/services/auth-service.ts` (`getCurrentUser`, ~dòng 125-127) | A | `GET /auth/me` trả `{success,message,data:{user}}` nhưng code đọc `response.data.user` → luôn `undefined`, ném 'Invalid user data', rơi về cache. API /me thực chất KHÔNG BAO GIỜ parse được. | Đọc `response.data.data?.user ?? response.data.user`. | |
| 2 | `features/auth/services/auth-service.ts` (`updateUserProfile`, ~191-192) | A | `PUT /auth/me` trả `data:{user}` nhưng đọc `response.data.user` → cập nhật profile set user = undefined. | Đọc `response.data.data?.user`. | |
| 3 | `features/auth/services/auth-service.ts` (`register`, ~168-169) | A | Nhánh fallback (lỗi token) backend trả `data:{user,message}`, FE đọc `response.data.user/token` → undefined, REGISTER_SUCCESS payload undefined. | Fallback đọc thêm `response.data.data?.user`. | |
| 4 | `features/auth/pages/oauth-callback.tsx` (~dòng 18) | A | Chỉ lưu `token`, KHÔNG lưu `user` và không gọi loadUser/getCurrentUser → sau redirect context vẫn chưa đăng nhập, OAuth user không vào được route protected. | Sau khi set token, gọi `getCurrentUser()` (sau khi sửa #1) rồi mới navigate. | |
| 5 | `features/auth/contexts/auth-context.tsx` (loadUser ~122-133) | A (hệ quả) | Khôi phục session phụ thuộc cache localStorage vì /me parse sai (#1); nếu mất cache thì session không khôi phục dù token còn hạn. | Tự khỏi sau khi sửa #1; cân nhắc luôn gọi /me để xác thực token. | |

> Lưu ý: `login`/`updatePassword` parse ĐÚNG (backend trả token+user top-level). Token lưu đúng key `'token'`/`'user'` khớp interceptor.

---

## 2. CART (Ưu tiên CAO — xương sống)

| # | File | Loại | Vấn đề | Đề xuất sửa | Duyệt |
|---|------|------|--------|-------------|-------|
| 6 | `features/cart/cart-context.tsx` | B/D | KHÔNG có call API nào — toàn bộ chạy bằng localStorage key `kitchen_cart`. Backend có cart controller đầy đủ (`GET /cart`, `POST/PUT/DELETE /cart/items/:id`, `DELETE /cart`, `/cart/summary`, `/cart/merge`) nhưng FE chưa nối. Shape `CartItem` FE (`{id,productId,name,price,image,variant,quantity}`) không khớp backend (`{_id,productId,variantId,quantity,price,...}`). | Tạo `cart-service.ts` gọi `/cart*`, parse `response.data.data.cart`, map sang CartItem FE. Giữ localStorage làm guest cart, gọi `/cart/merge` sau login. Bổ sung `endpoints.cart` vào config. | |
| 7 | `components/layout/client/ClientHeader.tsx` | C | UI giỏ hàng (sidebar, badge, list, subtotal, nút xóa/đổi SL, thanh toán) đầy đủ nhưng nguồn dữ liệu chỉ từ cart-context (localStorage). | Dùng lại gần như nguyên vẹn sau khi cart-context nối API qua `useCart()`. | |
| 8 | `features/products/pages/client/ProductDetail.tsx` (`handleAddToCart` ~120-133) | C | `addItem` chỉ ghi localStorage, không gọi `POST /cart/items`. | Khi nối cart API, gửi `{productId, variantId, quantity}` cho backend. | |

---

## 3. CHECKOUT & ORDER (Ưu tiên CAO — xương sống)

| # | File | Loại | Vấn đề | Đề xuất sửa | Duyệt |
|---|------|------|--------|-------------|-------|
| 9 | `pages/client/Checkout/CheckoutPage.tsx` | C/B | `cartItems` mock hardcode (không dùng `useCart()`). `handleSubmitOrder` chỉ `alert()`, KHÔNG gọi `POST /orders` hay `POST /payments/initiate`. Giảm giá hardcode 300k cho mọi mã (không gọi `/vouchers/apply`). Nút "Áp dụng" không có handler. Form thu thập số thẻ/CVV trực tiếp (rủi ro PCI). | Dùng `useCart()`; tạo `orderService.createOrder({items,address,paymentMethod,voucherCode})` → `data.order`; nếu không phải COD gọi `/payments/initiate` rồi redirect; nối "Áp dụng" với `/vouchers/apply`. | |
| 10 | `pages/client/order/Myorder.tsx` | C | `orders` mock hardcode, không gọi `GET /orders`. Nút "Hủy đơn"/"Mua lại" không có handler. **BUG biên dịch**: dùng `<Check>` nhưng không import từ lucide-react → lỗi khi render tab shipping. | Tạo `orderService.getMyOrders()` → `data.orders`+`data.pagination`, dùng React Query; nối cancel với `PUT /orders/:id/cancel`; thêm `Check` vào import. | |
| 11 | `pages/orders/OrderList.tsx` (dashboard) | C | `generateMockOrders()` 50 đơn ngẫu nhiên, không gọi `GET /orders`. Action (xem/giao/hoàn thành/hủy) không có handler. Nút Excel/In không handler. | Tạo `orderService.getOrders(params)` → `data.orders`+`data.pagination`, React Query; nối action với `PUT /orders/:id/status`. | |

---

## 4. USERS & VOUCHER (Ưu tiên CAO–TB)

| # | File | Loại | Vấn đề | Đề xuất sửa | Duyệt |
|---|------|------|--------|-------------|-------|
| 12 | `features/users/services/user-service.ts` (`getUserStats` ~160, `searchUsers` ~173) | A | Gọi `GET /users/stats` & `/users/search` — cả hai **bị shadow** bởi `/:id` (xem F2) → không gọi được, lỗi bị nuốt → Stats Cards ở UserList không bao giờ hiện. | Sửa thứ tự route ở BE (F2) rồi mới dùng; tạm thời ẩn Stats Cards. | |
| 13 | `features/users/services/user-service.ts` (`getUsers` ~44-45, `getUserById` ~92, `updateUser`, `restoreUser`) | A | Đọc `response.data.users`/`response.data.user` trực tiếp. Nếu BE bọc `data:{users}` thì thiếu một cấp `.data` → parse sai. Cần xác nhận wrapper. | Đổi sang `response.data.data.users`/`.user` nếu BE bọc. | |
| 14 | `features/users/services/user-service.ts` (`changeUserRole` ~120) | A | Gọi `PUT /users/:id/role` nhưng BE chỉ có `PUT /users/:id`. Endpoint `/role` có thể không tồn tại. | Đổi sang `PUT /users/:id` body `{role}` (hoặc thêm route BE). | |
| 15 | `features/users/hooks/useUsers.ts` (~dòng 8-12) | A | Import type từ `'../../../types/user-interfaces'` — đường dẫn KHÔNG tồn tại → lỗi TS/build. | Sửa path import về `interfaces/interface.ts` đúng. | |
| 16 | `features/users/pages/UserList.tsx` (~16-18) | A | Import sai path (`../../../types/user`), file vừa move từ `pages/users/` mà chưa sửa import. Nút "Xem chi tiết"/"Thêm" không handler. Stats Cards phụ thuộc stats luôn undefined. | Sửa import path; kiểm tra build; ẩn/sửa Stats Cards. | |
| 17 | `pages/client/Voucher/VouchersPage.tsx` | C | `vouchers` mock hardcode, không gọi `GET /vouchers/public`. **Cảnh báo parse**: `/vouchers/public` trả `data` LÀ MẢNG trực tiếp → phải đọc `response.data.data` (mảng), KHÔNG phải `.data.vouchers`. Nút "Dùng ngay" chỉ redirect, chưa nối `/vouchers/apply`. | Tạo `voucherService.getPublicVouchers()` return `response.data.data` (mảng); map sang UI. | |

---

## 5. PRODUCTS / CATEGORY / VARIANTS / CUSTOMIZATIONS (đa số loại A) (HOÀN THÀNH)

> Đã xác nhận: KHÔNG có mock data ở nhóm này — tất cả đã gọi API thật. Vấn đề chủ yếu là parse sai cấp `.data` và lệch version React Query.

| # | File | Loại | Vấn đề | Đề xuất sửa | Duyệt |
|---|------|------|--------|-------------|-------|
| 18 | `features/products/pages/dashboard/EditProductPage.tsx` (~dòng 71) | A | Truyền `product={productData.product}` thay vì `productData.data.product` → form Edit luôn nhận undefined, không prefill, edit thành add. | `product={productData.data.product}`. | |
| 19 | `features/products/pages/dashboard/ProductListPage.tsx` (~108-113) | A | Pagination đọc `productsData.pagination` thay vì `productsData.data.pagination` → total luôn 0, admin không phân trang được. | Đọc `const {products, pagination} = productsData?.data`. Xác nhận tên field pagination từ BE. | |
| 20 | `features/products/components/ProductCustomizations/ProductCustomizations.tsx` (~dòng 50) | A | `return response.data.customizations` thiếu một cấp `.data` → bảng luôn rỗng. Có thể là CODE CHẾT (route chỉ dùng ProductCustomizationsPage). | Sửa `response.data.data.customizations` HOẶC xóa file nếu không dùng. | |
| 20b | `features/category/components/dashboard/CategoryManagement.tsx` (~103-104) | A | Dùng `deleteMutation.isPending`/`isPending` (API React Query v5) nhưng project là v4 → luôn undefined, nút không hiện loading. | Đổi sang `.isLoading`. | |
| 20c | `features/category/service/categoryService.ts` (`getCategory` ~29-32) | A | Trả `response.data?.data \|\| response.data` → ra object `{category}` chứ không phải category. | Đọc `response.data?.data?.category`. | |
| 20d | `features/customizations/service/customizationService.ts` (`getProductCustomization` ~21) | A | `response.data?.customization` thiếu cấp `.data`. | Đọc `response.data?.data?.customization`. | |
| 20e | `features/variants/interfaces/interface.ts` + client `ProductDetail.tsx` | A | Hai interface (`ProductVariant` dùng `priceAdjustment` vs `Variant` dùng `price/attributes`) cho CÙNG endpoint `/products/:id/variants` → một phía hiển thị sai giá/thuộc tính. | Chốt shape variant thật từ BE rồi thống nhất 1 interface. | |
| 20f | `AddProductPage.tsx` + `EditProductPage.tsx` | A (nhẹ) | Query `['categories']` fetch nhưng không dùng (dead fetch). | Xóa query thừa. Dọn `console.log` debug ở ProductDetailPage/CustomizationList. | |


---

## 6. TRANG ADMIN dùng MOCK DATA — backend SẴN SÀNG thay thật (Ưu tiên TB)

> Đặc điểm chung: các trang này KHÔNG import config API, KHÔNG dùng React Query — 100% mock data / `console.log`. Backend đã có endpoint tương ứng, chỉ cần viết service + nối.

| # | File | Loại | Vấn đề | Đề xuất sửa | Duyệt |
|---|------|------|--------|-------------|-------|
| 21 | `pages/recipes/RecipeManagement.tsx` | C + BUG | **File là bản COPY nguyên xi của ReviewManagement** (cùng interface Review, generateMockReviews, UI duyệt đánh giá) — không phải quản lý công thức. | Viết lại đúng chức năng recipe + nối `GET/DELETE /recipes`. | |
| 22 | `pages/reviews/ReviewManagement.tsx` | C | `generateMockReviews()` 50 mục; approve/reject/delete/reply chạy local. | Nối `GET /reviews`, `/reviews/admin/pending`, `/admin/reported`, `PUT approve/reject`. Map tab status vào endpoint. | |
| 23 | `pages/marketing/FlashSaleList.tsx` | C | `generateMockFlashSales()` 25 mục; filter/sort/delete/toggle local. | Nối `GET /flash-sales` (mảng trực tiếp), `DELETE/PUT /flash-sales/:id`. | |
| 24 | `pages/marketing/AddFlashSale.tsx` | C+B | `mockProducts` 20 sp; submit chỉ `console.log`+`alert`. | Chọn sp từ `GET /products`; lưu qua `POST /flash-sales`. | |
| 25 | `pages/marketing/Vouchers.tsx` | C | `generateMockVouchers()` 30 mục; modal thêm rỗng; toggle/delete local. | Nối voucher admin CRUD `GET/POST/PUT/DELETE /vouchers`. | |
| 26 | `pages/recipes/AddRecipe.tsx` | B/C | Form đầy đủ; submit chỉ `console.log`+`alert`; input ảnh không upload. | Nối `POST /recipes` + `uploadUtils.createFormData`; related products chọn từ `GET /products`. | |
| 27 | `pages/dashboard/dashboard-overview.tsx` | C/D | Toàn bộ thẻ thống kê + đơn gần đây + sp bán chạy là mock. | Nối: đơn gần đây→`GET /orders`; bán chạy→`GET /products/best-selling`; thẻ→`/orders/stats`,`/payments/stats`. Lượt xem + chart timeseries: **thiếu backend**. | |

---

## 7. TRANG ưu tiên THẤP / một phần thiếu backend

| # | File | Loại | Vấn đề | Đề xuất sửa | Duyệt |
|---|------|------|--------|-------------|-------|
| 28 | `pages/marketing/BundleManagement.tsx` | C | `mockBundles` 20 mục; delete/bulk local. Backend bundles CRUD đã có. | Nối `GET /bundles`, `DELETE /bundles/:id`. | ✅ Đã nối: tạo `features/bundles` (service/hook/interface), `GET /bundles` (server pagination+search) + `DELETE /bundles/:id`, thêm `endpoints.bundles`. |
| 29 | `pages/notification/NotificationManagement.tsx` | C/D | `generateMockNotifications()` 30 mục. Backend có CRUD notifications (cần auth). Các field analytics (`openRate/clickRate/recipients`) **backend không trả**. Route `/unread-count`,`/read` bị shadow (F2). | Nối `GET/POST/DELETE /notifications`; bỏ field analytics không có nguồn. | ✏️ Đã nối: tạo `features/notifications`, `GET /notifications` (per-user) + mark-read + `DELETE /:id`. Bỏ analytics/campaign (BE không có). Gửi hàng loạt cần endpoint admin mới. |
| 30 | `pages/reports/BestsellersReport.tsx` | C/D | `bestsellersData` mock. Bảng top sp có thể dùng `GET /products/best-selling`. Phân bố theo danh mục + 3 thẻ tổng: **thiếu backend**. | Nối top sp với `/products/best-selling`; phần category cần BE mới. | ✏️ Đã nối bảng top sp với `/products/best-selling` (popularity/rating). Bỏ sales/revenue/stock/phân bố danh mục/thẻ tổng (cần endpoint thống kê BE). |
| 31 | `pages/reports/SalesReport.tsx` | D | Toàn bộ mock. **KHÔNG có endpoint reports/sales**. Chỉ ghép một phần từ `/orders/stats`,`/payments/stats`. Chart timeseries/lợi nhuận/conversion: thiếu BE. | Cần xây endpoint reports ở BE trước. | ❌ Chưa làm: BE chưa có route reports/sales (đã xác nhận trong app.js). Cần xây endpoint trước. |
| 32 | `pages/reports/CustomerReport.tsx` | D | Toàn bộ mock. **Không có endpoint customer-report**; `/users/stats` bị shadow (F2). | Cần xây endpoint BE trước. | ❌ Chưa làm: BE chưa có endpoint customer-report. Cần xây trước. |
| 33 | `pages/ai-assistant/AIAssitantManagement.tsx` | D→C | Mock toàn bộ. ~~Chỉ có `GET /api/ai` trả plain text~~ **(SAI — BE đã có đầy đủ AI API)**. Dùng `<style jsx>` (Next.js) sai trong Vite; `Eye` icon dùng nhưng không import (lỗi biên dịch). | Cần xây toàn bộ AI backend trước; sửa lỗi biên dịch trước mắt. | ✅ Đã hoàn thiện: sửa lỗi biên dịch (import `Eye`, bỏ import thừa, `<style jsx>`→`<style>`). Tạo `features/ai` (interface/service/hooks) + `endpoints.ai`. Nối tab Tổng quan (`/ai/analytics/intent-distribution`, `/ai/analytics/feedback-stats`, `/ai/chat/frequent-queries`) + tab Hội thoại (`/ai/chat/history` theo session/user). Intents (BE do Python service, chưa expose API) + Settings (BE chưa có) giữ local kèm banner ghi rõ. |
| 34 | `pages/settings/SystemSetting.tsx` | B/D | `onSubmit`/`handleClearCache` chỉ TODO + `console.log`. Chưa rõ BE có endpoint settings. | Xác nhận endpoint BE; nếu có → viết service nối; nếu không → D. | ❌ Đã xác nhận: BE KHÔNG có endpoint settings (app.js không đăng ký route). → D, cần xây BE trước. |

---

## Đề xuất thứ tự thực hiện

**Đợt 0 — Sửa nền tảng backend (chặn nhiều task)**: F2 (routing-order), F5 (ApiError voucher), F3/F4 (dọn config endpoints).
**Đợt 1 — Xương sống (CAO)**: #1-5 Auth → #6-8 Cart → #9-11 Checkout/Order → #12-17 Users/Voucher.
**Đợt 2 — Sửa parse Products/Category (CAO-TB)**: #18-20f.
**Đợt 3 — Nối mock data admin (TB)**: #21-27.
**Đợt 4 — Thấp / cần BE mới**: #28-34.

> Nhiều task ghi "xác nhận shape/field BE" — nên chốt một vài response thật (chạy thử 1 endpoint) trước Đợt 1 để khỏi sửa parse 2 lần.
