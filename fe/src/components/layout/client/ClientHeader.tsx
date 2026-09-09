import { useEffect, useRef, useState } from "react";
import {
  ShoppingBag,
  Search,
  UserRound,
  Menu,
  X,
  Heart,
  Plus,
  Minus,
  Trash2,
  ArrowRight,
  ChefHat,
} from "lucide-react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useCart } from "../../../features/cart/context/cart-hook";
import { useAuth } from "../../../features/auth/hooks/auth-hook";
import {
  defaultSettings,
  useStoreSettings,
} from "../../../features/store/useStoreSettings";
import { urlUtils } from "../../../config/api_cli.config";

export default function ClientHeader({
  categories,
}: {
  categories: { _id: string; name: string }[];
}) {
  const [menu, setMenu] = useState(false);
  const [cart, setCart] = useState(false);
  const [search, setSearch] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const navigate = useNavigate();
  const { state } = useAuth();
  const { data: settings = defaultSettings } = useStoreSettings();
  const {
    items,
    totalItems,
    subtotal,
    removeItem,
    updateQuantity,
    isSyncing,
    syncError,
    refreshCart,
  } = useCart();
  useEffect(() => {
    if (cart) dialog.current?.showModal();
    else dialog.current?.close();
    document.body.style.overflow = cart || menu ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [cart, menu]);
  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    navigate(
      `/shop/category/all${
        search.trim() ? `?search=${encodeURIComponent(search.trim())}` : ""
      }`
    );
    setMenu(false);
  };
  const searchForm = (
    <form className="store-search" onSubmit={submitSearch}>
      <Search size={18} />
      <input
        aria-label="Tìm sản phẩm"
        placeholder="Bạn đang tìm gì cho căn bếp?"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <button
        type="submit"
        className="icon-button"
        title="Tìm kiếm"
        aria-label="Tìm kiếm"
      >
        <ArrowRight size={17} />
      </button>
    </form>
  );
  return (
    <>
      <div className="announcement">
        <span>Gọn gian bếp. Trọn niềm vui.</span>
        <span>
          Miễn phí vận chuyển từ{" "}
          {settings.freeShippingThreshold.toLocaleString("vi-VN")} ₫
        </span>
        <Link to="/shop/support">
          Hỗ trợ khách hàng <ArrowRight size={12} />
        </Link>
      </div>
      <header className="store-header">
        <div className="store-container header-main">
          <button
            className="icon-button mobile-menu-toggle"
            aria-label="Mở danh mục"
            title="Danh mục"
            onClick={() => setMenu(true)}
          >
            <Menu size={23} />
          </button>
          <Link className="brand" to="/shop/home">
            <ChefHat size={30} strokeWidth={1.4} />
            <span>
              kitchen<span className="brand-dot">e.</span>
            </span>
          </Link>
          <div className="desktop-search">{searchForm}</div>
          <div className="header-actions">
            <Link
              className="icon-button desktop-wish"
              to="/shop/account/wishlist"
              title="Yêu thích"
              aria-label="Yêu thích"
            >
              <Heart size={21} />
            </Link>
            <Link
              className="icon-button"
              to="/shop/account"
              title="Tài khoản"
              aria-label="Tài khoản"
            >
              <UserRound size={21} />
            </Link>
            <button
              className="icon-button cart-toggle"
              onClick={() => setCart(true)}
              title="Giỏ hàng"
              aria-label={`Giỏ hàng (${totalItems})`}
            >
              <ShoppingBag size={22} />
              <span className="cart-count">{totalItems}</span>
            </button>
          </div>
        </div>
        <nav
          className="store-container header-nav"
          aria-label="Điều hướng cửa hàng"
        >
          <NavLink to="/shop/category/all">Tất cả sản phẩm</NavLink>
          {categories.slice(0, 4).map((c) => (
            <NavLink key={c._id} to={`/shop/category/${c._id}`}>
              {c.name}
            </NavLink>
          ))}
          <NavLink to="/shop/recipes">Góc vào bếp</NavLink>
          <NavLink to="/shop/assistant">Trợ lý AI</NavLink>
          <NavLink to="/shop/account/vouchers">Ưu đãi</NavLink>
          <span className="nav-spacer" />
          {["admin", "staff"].includes(state.user?.role || "") && (
            <Link to="/dashboard">
              Quản trị <ArrowRight size={14} />
            </Link>
          )}
        </nav>
      </header>
      {menu && (
        <div className="mobile-menu">
          <div className="section-heading">
            <span className="brand">kitchene.</span>
            <button
              className="icon-button"
              onClick={() => setMenu(false)}
              title="Đóng"
              aria-label="Đóng danh mục"
            >
              <X />
            </button>
          </div>
          {searchForm}
          <nav>
            <Link onClick={() => setMenu(false)} to="/shop/category/all">
              Tất cả sản phẩm
            </Link>
            {categories.map((c) => (
              <Link
                key={c._id}
                onClick={() => setMenu(false)}
                to={`/shop/category/${c._id}`}
              >
                {c.name}
              </Link>
            ))}
            <Link to="/shop/recipes" onClick={() => setMenu(false)}>
              Góc vào bếp
            </Link>
            <Link to="/shop/assistant" onClick={() => setMenu(false)}>Trợ lý AI</Link>
            <Link to="/shop/account/orders" onClick={() => setMenu(false)}>
              Đơn hàng của tôi
            </Link>
            <Link to="/shop/account/wishlist" onClick={() => setMenu(false)}>
              Yêu thích
            </Link>
          </nav>
        </div>
      )}
      <dialog
        ref={dialog}
        className="cart-dialog"
        onCancel={() => setCart(false)}
        onClick={(e) => {
          if (e.target === dialog.current) setCart(false);
        }}
      >
        <div className="cart-panel">
          <div className="section-heading">
            <h2>
              Giỏ hàng <span className="muted">({totalItems})</span>
            </h2>
            <button
              className="icon-button"
              onClick={() => setCart(false)}
              aria-label="Đóng giỏ hàng"
              title="Đóng"
            >
              <X />
            </button>
          </div>
          {syncError && (
            <div className="error-banner">
              {syncError}
              <button onClick={() => refreshCart()}>Thử lại</button>
            </div>
          )}
          {!items.length ? (
            <div className="request-state">
              <ShoppingBag size={44} strokeWidth={1} />
              <h3>
                {isSyncing ? "Đang tải giỏ hàng..." : "Giỏ hàng đang trống"}
              </h3>
              <button
                className="button"
                onClick={() => {
                  setCart(false);
                  navigate("/shop/category/all");
                }}
              >
                Khám phá sản phẩm <ArrowRight size={16} />
              </button>
            </div>
          ) : (
            <>
              <div className="shipping-progress">
                <p>
                  {subtotal >= settings.freeShippingThreshold
                    ? "Đơn hàng được miễn phí vận chuyển"
                    : `Thêm ${(
                        settings.freeShippingThreshold - subtotal
                      ).toLocaleString("vi-VN")} ₫ để miễn phí vận chuyển`}
                </p>
                <progress
                  max={Math.max(1, settings.freeShippingThreshold)}
                  value={subtotal}
                />
              </div>
              <div className="cart-lines">
                {items.map((item) => (
                  <div className="cart-line" key={item.id}>
                    <img
                      src={item.image || urlUtils.getFallbackImageUrl()}
                      alt={item.name}
                      onError={(e) => {
                        e.currentTarget.onerror = null;
                        e.currentTarget.src = urlUtils.getFallbackImageUrl();
                      }}
                    />
                    <div className="cart-line-main">
                      <Link
                        to={`/shop/product/${item.productId}`}
                        onClick={() => setCart(false)}
                      >
                        {item.name}
                      </Link>
                      {item.variant && <small>{item.variant}</small>}
                      <strong>
                        {(item.price * item.quantity).toLocaleString("vi-VN")} ₫
                      </strong>
                      <div className="quantity-stepper">
                        <button
                          disabled={isSyncing}
                          onClick={() =>
                            updateQuantity(item.id, item.quantity - 1)
                          }
                          aria-label={`Giảm ${item.name}`}
                        >
                          <Minus size={14} />
                        </button>
                        <span>{item.quantity}</span>
                        <button
                          disabled={isSyncing}
                          onClick={() =>
                            updateQuantity(item.id, item.quantity + 1)
                          }
                          aria-label={`Tăng ${item.name}`}
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                    </div>
                    <button
                      disabled={isSyncing}
                      className="icon-button"
                      onClick={() => removeItem(item.id)}
                      title="Xóa"
                      aria-label={`Xóa ${item.name}`}
                    >
                      <Trash2 size={17} />
                    </button>
                  </div>
                ))}
              </div>
              <div className="cart-summary">
                <div>
                  <span>Tạm tính</span>
                  <strong>{subtotal.toLocaleString("vi-VN")} ₫</strong>
                </div>
                <button
                  className="button full"
                  disabled={isSyncing || !!syncError}
                  onClick={() => {
                    setCart(false);
                    navigate("/shop/checkout");
                  }}
                >
                  {isSyncing ? "Đang cập nhật..." : "Tiến hành thanh toán"}
                  <ArrowRight size={17} />
                </button>
                <Link to="/shop/category/all" onClick={() => setCart(false)}>
                  Tiếp tục mua sắm
                </Link>
              </div>
            </>
          )}
        </div>
      </dialog>
    </>
  );
}
