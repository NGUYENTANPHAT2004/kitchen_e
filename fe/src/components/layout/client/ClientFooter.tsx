import { ArrowUpRight, ChefHat } from "lucide-react";
import { Link } from "react-router-dom";
import {
  defaultSettings,
  useStoreSettings,
} from "../../../features/store/useStoreSettings";

export default function ClientFooter({
  categories,
}: {
  categories: { _id: string; name: string }[];
}) {
  const { data: settings = defaultSettings } = useStoreSettings();
  return (
    <footer className="store-footer">
      <div className="store-container footer-grid">
        <div>
          <Link className="brand" to="/shop/home">
            <ChefHat size={30} strokeWidth={1.3} />
            kitchene.
          </Link>
          <p>
            Những điều giản dị.
            <br />
            Cho căn bếp bạn yêu.
          </p>
          <Link className="text-link" to="/shop/support">
            Kết nối với Kitchen E <ArrowUpRight size={16} />
          </Link>
        </div>
        <div>
          <h3>Khám phá</h3>
          <Link to="/shop/category/all">Tất cả sản phẩm</Link>
          {categories.slice(0, 4).map((c) => (
            <Link key={c._id} to={`/shop/category/${c._id}`}>
              {c.name}
            </Link>
          ))}
        </div>
        <div>
          <h3>Tài khoản</h3>
          <Link to="/shop/account">Thông tin cá nhân</Link>
          <Link to="/shop/account/orders">Đơn hàng của tôi</Link>
          <Link to="/shop/account/wishlist">Sản phẩm yêu thích</Link>
          <Link to="/shop/account/vouchers">Mã ưu đãi</Link>
        </div>
        <div>
          <h3>Chăm sóc khách hàng</h3>
          <Link to="/shop/support">Liên hệ & hỗ trợ</Link>
          <Link to="/shop/recipes">Góc vào bếp</Link>
          {settings.contactEmail && (
            <a href={`mailto:${settings.contactEmail}`}>
              {settings.contactEmail}
            </a>
          )}
          {settings.contactPhone && (
            <a href={`tel:${settings.contactPhone}`}>{settings.contactPhone}</a>
          )}
          {settings.address && <p>{settings.address}</p>}
        </div>
      </div>
      <div className="store-container footer-bottom">
        <span>© {new Date().getFullYear()} Kitchen E</span>
        <span>Được chọn cho căn bếp mỗi ngày.</span>
        <Link to="/shop/privacy">Quyền riêng tư</Link>
      </div>
    </footer>
  );
}
