# Báo cáo đối chiếu Medusa và Kitchen E

Ngày cập nhật: **21/07/2026**

## 1. Kết luận điều hành

Kitchen E nên **áp dụng kiến trúc và pattern của Medusa theo từng phần**, không nên thay toàn bộ dự án bằng Medusa ở thời điểm hiện tại.

Các pattern có giá trị cao nhất đã hoặc đang được đưa vào dự án:

- chia ranh giới nghiệp vụ: catalog, pricing, inventory, cart, promotion, order và payment;
- workflow nhiều bước có transaction và bước bù trừ;
- cập nhật tồn kho bằng thao tác atomic thay vì đọc rồi lưu lại document;
- định giá và xác minh voucher lại ở backend khi checkout;
- idempotency key cho đặt hàng và khởi tạo thanh toán;
- payment webhook có xác minh chữ ký, chống phát lại và kiểm soát chuyển trạng thái;
- tách side effect khỏi transaction bằng event/subscriber trong giai đoạn tiếp theo.

## 2. Phiên bản và thay đổi Medusa đã đối chiếu

Phiên bản Medusa mới nhất được kiểm tra ngày **21/07/2026** là **v2.17.2**.

Các thay đổi gần đây đáng chú ý đối với Kitchen E:

### Medusa v2.17.2

Release v2.17.2 tập trung vào các capability rất sát với Kitchen E:

- **Admin Layout Composer:** dashboard có thể sắp xếp Topbar, Sidebar, Settings Sidebar và page bằng kéo-thả; bố cục được lưu để dùng lại.
- **Async Payment Methods:** payment có thể hoàn tất sau request ban đầu thông qua provider webhook, đồng bộ xuyên Payment module, workflow và Admin.
- **Tiered Pricing:** price list hỗ trợ nhiều mức giá theo số lượng cho từng variant và currency.
- **Contextual Browser Tab Titles:** title của list/detail page được sinh theo nội dung, giúp phân biệt nhiều tab.

**Áp dụng vào Kitchen E:**

1. Giữ payment pending cho chuyển khoản và các gateway xác nhận bất đồng bộ; chỉ capture khi callback đã xác minh.
2. Xây Admin extension cho cảnh báo tồn kho, payment lỗi và AI analytics thay vì sửa trực tiếp shell dashboard.
3. Thiết kế price list/tiered pricing sau khi hoàn tất pricing service hiện tại.
4. Thêm contextual page title như một hạng mục P2 nhỏ, ít rủi ro.

Các capability này cho thấy hướng phát triển của Medusa là mở rộng qua module, workflow, provider và admin extension, thay vì dồn business logic vào controller.

### Medusa v2.17.0 — Global Product Options

- Cho phép định nghĩa option dùng lại toàn hệ thống như màu sắc, kích thước, vật liệu rồi gán vào nhiều sản phẩm.
- Giảm dữ liệu lặp, hạn chế sai chính tả/không đồng nhất giữa các sản phẩm và hỗ trợ thao tác quản trị hàng loạt tốt hơn.
- Phù hợp trực tiếp với Kitchen E vì catalog hiện có variant và customization nhưng chưa có thư viện option chuẩn hóa dùng chung.

**Áp dụng đề xuất:** tạo `ProductOptionDefinition` và `ProductOptionValue`, liên kết variant bằng ID thay vì lưu chuỗi tự do; giữ customization có giá như một lớp cấu hình riêng để không trộn với variant tồn kho.

### Release train 2.15.5 → 2.17.1 nên theo dõi

Ngoài v2.17.2, các release ngay trước có một số hướng phù hợp với Kitchen E:

- provider-agnostic auth verification và MFA cho admin/account;
- multi-shipping-method cart cho split shipment;
- tax line context hook để tách logic thuế khỏi order controller;
- admin injection zones cho draft order, gift card, store credit và các trang tùy chỉnh.

**Ưu tiên Kitchen E:** MFA và provider auth là P1 security; tax context là P1 khi bắt đầu tính VAT; split shipment và gift card/store credit là P2 sau khi payment/outbox ổn định.

### Pattern nền tảng của Medusa

- **Modules:** đóng gói nghiệp vụ và dữ liệu theo domain.
- **Workflows:** mô tả chuỗi bước, transaction và compensation.
- **Events/Subscribers:** tách email, thông báo, analytics và tác vụ hậu kỳ khỏi request chính.

Nguồn chính thức:

- Medusa repository: https://github.com/medusajs/medusa
- Release v2.17.2: https://github.com/medusajs/medusa/releases/tag/v2.17.2
- Global Product Options: https://medusajs.com/blog/announcing-global-product-options/
- Recent release train: https://medusajs.com/blog/medusa-newsletter-june-2026/
- Modules: https://docs.medusajs.com/learn/fundamentals/modules
- Workflows: https://docs.medusajs.com/learn/fundamentals/workflows
- Events and subscribers: https://docs.medusajs.com/learn/fundamentals/events-and-subscribers

## 3. Hiện trạng kiến trúc Kitchen E

| Khu vực | Hiện trạng | Đánh giá |
|---|---|---|
| Backend | Express + Mongoose | Có đủ domain nhưng controller còn chứa nhiều nghiệp vụ |
| Frontend | React 19 + Vite + TypeScript | Build và test đã xanh; bundle chính còn lớn |
| AI | FastAPI | Nên được xem như provider/subscriber, không gọi trực tiếp trong transaction commerce |
| Checkout | Transaction MongoDB, atomic inventory, server pricing, voucher consume | Đã cải thiện đáng kể; còn cần test concurrency bằng replica set thật |
| Payment | Pending session, signed return, signed/idempotent webhook | An toàn hơn; phần tạo session MoMo/ZaloPay vẫn chỉ là mô phỏng |
| Static files | Một điểm mount, fallback thống nhất | Đã xử lý lỗi route chồng và /uploads/uploads |
| Docker | Dockerfile backend/frontend và Mongo replica set | Đã bổ sung cấu hình; chưa chạy full stack trong audit này |

## 4. Các lỗi và rủi ro đã xử lý

### 4.1 Schema và route

- Sửa User schema để thực sự lưu addresses, defaultAddress và timestamps.
- Khai báo các field đang được middleware/controller ghi: lastActivity, avatarPath, isLocked, lockUntil.
- Đưa route literal lên trước route động ở notifications, categories, bundles và reviews.
- Bổ sung import ApiError bị thiếu trong voucher router.

### 4.2 Inventory và flash sale

- Đồng bộ FlashSaleItem theo field thật là quantity, quantitySold và virtual remainingQuantity.
- Thêm inventory service với conditional atomic update:
  - chỉ trừ stock khi stockQuantity còn đủ;
  - chỉ tăng quantitySold khi quota flash sale còn đủ;
  - hoàn kho trong transaction khi hủy đơn.
- Hủy đơn dùng bước claim trạng thái có điều kiện trước khi hoàn kho, giảm nguy cơ hai request cùng hoàn tồn kho.

### 4.3 Pricing và voucher

- Checkout không còn tin totalAmount, shippingFee, discountAmount hoặc item price do frontend gửi.
- Giá order item được tính lại từ Product, ProductVariant, flash sale và customization ở backend.
- API xem trước voucher đọc giỏ hàng active từ database thay vì tin cartTotal/cartItems từ client.
- Voucher có giới hạn product/category chỉ giảm trên các line hợp lệ.
- Usage counter và private voucher assignment được consume bằng update atomic trong transaction.

### 4.4 Idempotency

- Thêm IdempotencyKey model và service.
- POST /orders và POST /payments/initiate hỗ trợ header Idempotency-Key.
- Cùng key và cùng payload có thể trả lại response đã hoàn thành.
- Cùng key nhưng payload khác bị từ chối với HTTP 409.
- Frontend đã tự sinh Idempotency-Key khi tạo order.
- CORS đã cho phép header Idempotency-Key.

### 4.5 Payment

- Pending payment tạo cùng order được tái sử dụng nhưng vẫn tiếp tục tạo redirect URL.
- Hỗ trợ bank_transfer như payment bất đồng bộ/thủ công ở trạng thái pending.
- Loại bỏ đường dẫn cho phép query status=success tự đổi payment thành completed.
- VNPay return tìm payment bằng vnp_TxnRef và bắt buộc chữ ký hợp lệ.
- Webhook VNPay, MoMo và ZaloPay đi qua payment gateway boundary.
- Thêm PaymentWebhookEvent để chống xử lý lặp và phát hiện event ID bị tái sử dụng với payload khác.
- Webhook không được hạ payment đã completed về failed do callback đến muộn.
- Event webhook failed hoặc mới chỉ được ghi nhận nhưng chưa xử lý xong có thể được gateway gửi lại để xử lý tiếp.
- Khi payment hoàn tất, order được đồng bộ rõ ràng sang `isPaid=true` và từ `pending` sang `processing`, không chỉ phụ thuộc vào document hook.
- Không áp trạng thái payment hoàn tất lên order đã `cancelled` hoặc `refunded`; trường hợp này được giữ lại để đối soát/refund.
- Không cho hủy order đã thanh toán qua cancel workflow; phải đi qua refund workflow riêng.

### 4.6 Static, rate limit và triển khai

- Bỏ mount static trùng lặp và lỗi /uploads/uploads.
- Route download/info được đăng ký trước catch-all static.
- Fallback ưu tiên PNG, nếu không có dùng SVG.
- Tăng budget limiter mặc định và bỏ request thành công khỏi bộ đếm dùng chung.
- Bổ sung Dockerfile cho backend và frontend, Nginx SPA fallback và .dockerignore.
- MongoDB trong Compose được cấu hình replica set rs0 để transaction Mongoose có thể hoạt động.

### 4.7 Frontend

- Sửa các lỗi TypeScript/import khiến production build thất bại.
- Bổ sung route chỉnh sửa sản phẩm.
- Đồng bộ shippingAddress theo contract backend.
- Đồng bộ phí vận chuyển hiển thị với backend: tiêu chuẩn 30.000đ, nhanh 50.000đ, miễn phí từ 500.000đ.
- Frontend không còn gửi tổng tiền và giá item để backend tin trực tiếp.

## 5. Kiểm thử hồi quy đã bổ sung

Kết quả cuối: **7 backend suites / 32 tests pass**, **13 frontend tests pass**, production build và TypeScript build đều pass.

- User schema và timestamps.
- Thứ tự route literal/dynamic.
- Flash-sale quantitySold và remainingQuantity.
- Atomic reserve/release tồn kho.
- Static SVG fallback.
- Server-side pricing.
- Voucher product/category eligibility.
- Idempotency replay và payload conflict.
- Chữ ký VNPay và MoMo.
- Pending payment reuse vẫn sinh redirect URL.
- Generic status=success không đổi payment.
- VNPay return tìm payment bằng vnp_TxnRef.
- Payment completed không bị callback failed đến muộn ghi đè.
- Payment completed đồng bộ sang order, và webhook đã ghi nhận nhưng bị gián đoạn có thể retry.
- Order đã thanh toán bị chặn hủy nhằm tránh tình trạng đã thu tiền nhưng hoàn kho như order chưa thanh toán.
- Cancellation workflow claim trạng thái trước khi hoàn kho.

## 6. Chức năng mới nên áp dụng tiếp

### P0 — Production correctness

1. Thay URL mô phỏng bằng provider adapter thật cho VNPay, MoMo và ZaloPay.
2. Đối chiếu canonical signing với tài liệu production của từng cổng thanh toán.
3. Chạy test đồng thời trên Mongo replica set thật:
   - hai checkout tranh cùng stock;
   - voucher maxUsage còn một lượt;
   - hai request hủy cùng order;
   - webhook gửi lặp và gửi đảo thứ tự.
4. Bổ sung outbox/event log để order commit và việc phát event không bị lệch trạng thái.

### P1 — Module và workflow

1. Chuyển createOrder thành create-order workflow có các bước rõ ràng.
2. Giữ cancel-order workflow hiện tại và bổ sung refund/capture workflow.
3. Tạo provider interface chung cho payment, storage, notification và AI.
4. Chuẩn hóa ApiResponse và validation Joi/Zod ở toàn bộ API boundary.
5. Tách limiter cho auth, public catalog, checkout và admin; production dùng Redis store.
6. Bổ sung MFA cho admin và provider auth verification theo hướng provider-agnostic.

### P2 — Tăng trưởng commerce

1. Global product options cho color, size, material và customization.
2. Price list, giá B2B, giá theo số lượng và bulk price editor.
3. Gift card, store credit và loyalty dựa trên payment captured event.
4. Dashboard extension cho cảnh báo tồn kho, payment lỗi, voucher và AI analytics.
5. Contextual browser title cho storefront/admin.
6. Code splitting để giảm main bundle hiện khoảng 1,5 MB.

## 7. Rủi ro còn lại

- MoMo/ZaloPay initiation hiện chưa gọi API thật; URL tạo ra vẫn là mô phỏng.
- Chữ ký gateway cần kiểm tra lại bằng bộ test fixture chính thức trước production.
- Chưa chạy full Docker stack và chưa chạy concurrency test với database thật.
- Idempotency record và order transaction chưa dùng transactional outbox chung.
- Event/subscriber cho email, socket, analytics và AI chưa được tách hoàn toàn.
- Backend lint còn **48 lỗi cũ** ngoài phạm vi batch; có cả cấu hình parser cũ không hiểu một số cú pháp hiện đại.
- Frontend còn 5 lint warning và cảnh báo bundle lớn.
- Nhiều chuỗi tiếng Việt cũ trong source đang bị mojibake; nên có một batch riêng để sửa encoding và thêm kiểm tra UTF-8.

## 8. Tiêu chí hoàn thành giai đoạn tiếp theo

- Backend và frontend test/build đều pass.
- Hai checkout đồng thời không làm stock âm.
- Một idempotency key không tạo hai order/payment session.
- Webhook sai chữ ký không đổi trạng thái payment.
- Webhook lặp không capture hai lần.
- Hủy một order chỉ hoàn stock một lần.
- Compose khởi động Mongo replica set, backend, frontend và AI ổn định.
- Thêm domain mới không cần sao chép business logic giữa các controller.
