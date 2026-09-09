"""Editable starter examples. Validation utterances are never fitted to the model."""
SEED_INTENTS = [
    {
        "key": "greeting", "label": "Chào hỏi", "handler": "response",
        "response": "Chào bạn! Mình là trợ lý Kitchen E. Bạn muốn tìm dụng cụ bếp, tham khảo công thức hay cần hỗ trợ mua hàng?",
        "train": ["Xin chào", "Chào bạn", "Hello shop", "Hi bạn ơi", "Chào buổi sáng", "Shop ơi có ai không", "Mình muốn nói chuyện với tư vấn viên", "Rất vui được gặp bạn", "Chào trợ lý Kitchen E", "Chào buổi tối"],
        "validation": ["Xin chào cửa hàng", "Hello bạn", "Chào buổi chiều"],
    },
    {
        "key": "product_inquiry", "label": "Hỏi về sản phẩm", "handler": "products", "response": "",
        "train": ["Chảo", "Máy xay", "Cửa hàng có nồi nào", "Dao bếp giá bao nhiêu", "Thớt gỗ còn hàng không", "Tôi muốn xem sản phẩm", "Cho xem dụng cụ bếp", "Nồi inox bao nhiêu tiền", "Có bán rây lọc không", "Thông tin về lò vi sóng", "Ly thủy tinh giá thế nào", "Giá chảo thép carbon"],
        "validation": ["Tôi muốn tìm một chiếc chảo", "Máy xay sinh tố giá bao nhiêu", "Cho mình xem dao bếp"],
    },
    {
        "key": "product_recommendation", "label": "Tư vấn chọn sản phẩm", "handler": "recommendations", "response": "",
        "train": ["Nên mua loại nào", "Gợi ý dụng cụ cho người mới nấu ăn", "Tư vấn bộ đồ bếp", "Sản phẩm nào phù hợp cho gia đình", "Nên chọn nồi hay chảo", "Gợi ý món đồ dưới 500 nghìn", "Tư vấn mua máy xay", "Loại chảo nào tốt nhất", "Đề xuất sản phẩm bán chạy", "Tôi cần tư vấn chọn quà", "Bếp nhỏ nên chọn dụng cụ gì", "So sánh các loại nồi"],
        "validation": ["Gợi ý cho tôi một chiếc nồi", "Tư vấn dụng cụ phù hợp người mới", "Nên mua sản phẩm nào cho bếp nhỏ"],
    },
    {
        "key": "order_status", "label": "Đơn hàng của tôi", "handler": "orders", "response": "",
        "train": ["Đơn hàng của tôi", "Kiểm tra tình trạng đơn hàng", "Đơn của tôi đã giao chưa", "Tra cứu mã đơn hàng", "Theo dõi đơn vừa đặt", "Tôi muốn hủy đơn hàng", "Đơn hàng đang ở đâu", "Xem lịch sử mua hàng", "Đơn số KH123 bao giờ tới", "Tình trạng đơn mua hôm qua"],
        "validation": ["Cho tôi xem trạng thái đơn hàng", "Kiểm tra đơn vừa mua", "Đơn hàng của mình tới đâu rồi"],
    },
    {
        "key": "cooking_tips", "label": "Công thức và mẹo bếp", "handler": "recipes", "response": "",
        "train": ["Cách nấu món ngon", "Cho tôi công thức nấu ăn", "Hướng dẫn làm bánh", "Mẹo chiên cá không dính", "Công thức cho người mới", "Nấu gì cho bữa tối", "Cách làm món canh", "Hướng dẫn nấu súp", "Mẹo nấu ăn tiết kiệm", "Công thức làm bánh đơn giản"],
        "validation": ["Có công thức nấu món nào dễ không", "Hướng dẫn cách làm bánh ngon", "Gợi ý công thức cho bữa tối"],
    },
    {
        "key": "shipping_policy", "label": "Chính sách vận chuyển", "handler": "response",
        "response": "Bạn có thể xem phí vận chuyển và ưu đãi giao hàng ở bước thanh toán trước khi đặt đơn. Mục Hỗ trợ khách hàng có thông tin liên hệ nếu bạn cần xác nhận thời gian giao đến địa chỉ của mình.",
        "train": ["Phí vận chuyển bao nhiêu", "Có miễn phí giao hàng không", "Cửa hàng giao hàng tỉnh không", "Phí ship tính thế nào", "Chính sách giao hàng", "Thời gian vận chuyển mấy ngày", "Mua bao nhiêu thì miễn phí ship", "Có giao hàng toàn quốc không", "Phí vận chuyển đến Hà Nội", "Ship hàng về tỉnh mất bao lâu"],
        "validation": ["Shop có freeship không", "Cho hỏi phí giao hàng", "Giao về tỉnh tính phí thế nào"],
    },
    {
        "key": "returns_policy", "label": "Đổi trả và bảo hành", "handler": "response",
        "response": "Bạn mở mục Hỗ trợ khách hàng để liên hệ về đổi trả hoặc bảo hành. Hãy chuẩn bị mã đơn và mô tả tình trạng sản phẩm để cửa hàng kiểm tra điều kiện áp dụng cho đơn của bạn.",
        "train": ["Chính sách đổi trả như thế nào", "Sản phẩm bị lỗi có đổi được không", "Tôi muốn trả hàng", "Bảo hành bao lâu", "Đổi sản phẩm khác được không", "Hướng dẫn yêu cầu hoàn tiền", "Hàng bị vỡ thì xử lý sao", "Điều kiện bảo hành sản phẩm", "Tôi cần hỗ trợ đổi hàng", "Thủ tục trả lại sản phẩm"],
        "validation": ["Cho hỏi cách đổi trả hàng", "Sản phẩm hỏng có bảo hành không", "Tôi muốn hoàn tiền trả sản phẩm"],
    },
    {
        "key": "payment_methods", "label": "Phương thức thanh toán", "handler": "response",
        "response": "Các phương thức thanh toán khả dụng được hiển thị ở bước thanh toán. Bạn chọn phương thức phù hợp và kiểm tra tổng tiền trước khi xác nhận đặt hàng.",
        "train": ["Thanh toán bằng cách nào", "Có trả tiền khi nhận hàng không", "Shop nhận chuyển khoản không", "Tôi muốn thanh toán online", "Những phương thức thanh toán", "Thanh toán qua thẻ được không", "Có hỗ trợ COD không", "Hướng dẫn thanh toán đơn", "Thanh toán bằng ngân hàng", "Tôi cần hỗ trợ việc thanh toán"],
        "validation": ["Có thể thanh toán khi nhận hàng không", "Cửa hàng có những cách thanh toán nào", "Tôi muốn trả tiền qua chuyển khoản"],
    },
]
