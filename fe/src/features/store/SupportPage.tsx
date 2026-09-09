import { Link } from "react-router-dom";
import { Mail, Phone, ArrowUpRight } from "lucide-react";
import ClientLayout from "../../components/layout/client/ClientLayout";
import { defaultSettings, useStoreSettings } from "./useStoreSettings";

export default function SupportPage({
  privacy = false,
}: {
  privacy?: boolean;
}) {
  const { data: settings = defaultSettings } = useStoreSettings();
  return (
    <ClientLayout>
      <div className="store-container section-space">
        <div className="section-heading">
          <div>
            <p className="eyebrow">KITCHEN E</p>
            <h1>{privacy ? "Quyền riêng tư" : "Chúng mình có thể giúp gì?"}</h1>
          </div>
        </div>
        {privacy ? (
          <div className="compact-page detail-block">
            <h2>Thông tin tài khoản và đơn hàng</h2>
            <p>
              Tên, email, số điện thoại và địa chỉ bạn cung cấp được sử dụng để
              quản lý tài khoản, xử lý đơn hàng và hỗ trợ giao hàng. Thông tin
              cần thiết cho giao hàng có thể được cung cấp cho đơn vị vận
              chuyển.
            </p>
            <h2>Dữ liệu lưu trên thiết bị</h2>
            <p>
              Website lưu phiên đăng nhập và giỏ hàng trên trình duyệt. Bạn có
              thể đăng xuất và xóa dữ liệu trình duyệt trên thiết bị của mình.
            </p>
            <h2>Yêu cầu hỗ trợ</h2>
            <p>
              Để yêu cầu xem, chỉnh sửa hoặc xóa dữ liệu tài khoản, vui lòng
              liên hệ cửa hàng. Dữ liệu đơn hàng có thể cần được giữ lại cho
              việc đối soát.
            </p>
            <Link className="text-link" to="/shop/support">
              Liên hệ Kitchen E <ArrowUpRight size={16} />
            </Link>
          </div>
        ) : (
          <div className="support-grid">
            <div>
              <h2 style={{ fontSize: 22, marginBottom: 22 }}>
                Liên hệ cửa hàng
              </h2>
              {settings.contactEmail && (
                <p className="detail-block">
                  <a
                    className="text-link"
                    href={`mailto:${settings.contactEmail}`}
                  >
                    <Mail size={18} />
                    {settings.contactEmail}
                  </a>
                </p>
              )}
              {settings.contactPhone && (
                <p className="detail-block">
                  <a
                    className="text-link"
                    href={`tel:${settings.contactPhone}`}
                  >
                    <Phone size={18} />
                    {settings.contactPhone}
                  </a>
                </p>
              )}
              {settings.address && (
                <p className="detail-block">{settings.address}</p>
              )}
              <Link
                className="button secondary"
                style={{ marginTop: 24 }}
                to="/shop/account/orders"
              >
                Theo dõi đơn hàng <ArrowUpRight size={16} />
              </Link>
            </div>
            <div>
              <details open>
                <summary>Phí vận chuyển được tính như thế nào?</summary>
                <p>
                  Giao tiêu chuẩn{" "}
                  {settings.standardShipping.toLocaleString("vi-VN")} ₫, giao
                  nhanh {settings.expressShipping.toLocaleString("vi-VN")} ₫.
                  Miễn phí cho đơn có giá trị sản phẩm từ{" "}
                  {settings.freeShippingThreshold.toLocaleString("vi-VN")} ₫.
                </p>
              </details>
              <details>
                <summary>Tôi có thể hủy đơn hàng không?</summary>
                <p>
                  Bạn có thể hủy đơn chưa thanh toán khi đơn chưa chuyển sang
                  trạng thái giao hàng. Với đơn đã thanh toán, vui lòng liên hệ
                  cửa hàng để đối soát.
                </p>
              </details>
              <details>
                <summary>Tôi thanh toán bằng cách nào?</summary>
                <p>
                  Bạn có thể chọn thanh toán khi nhận hàng. Chuyển khoản ngân
                  hàng được hiển thị khi cửa hàng đã cung cấp thông tin tài
                  khoản nhận tiền.
                </p>
              </details>
              <details>
                <summary>Sản phẩm có vấn đề khi nhận hàng?</summary>
                <p>
                  Giữ lại mã đơn hàng, hình ảnh sản phẩm và bao bì, sau đó liên
                  hệ cửa hàng để được kiểm tra và hỗ trợ.
                </p>
              </details>
            </div>
          </div>
        )}
      </div>
    </ClientLayout>
  );
}
