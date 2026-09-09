import { ArrowLeft, ArrowRight, LockKeyhole } from "lucide-react";
import { Link } from "react-router-dom";
import { useCheckout } from "../../../hooks/useCheckout";
import ClientLayout from "../../../../../components/layout/client/ClientLayout";
import RequestState from "../../../../../components/shared/RequestState";
import { urlUtils } from "../../../../../config/api_cli.config";

export default function CheckoutPage() {
  const checkout = useCheckout();
  const {
    items,
    subtotal,
    form,
    voucher,
    shippingFee,
    discount,
    total,
    applyingVoucher,
    isSubmitting,
    isSyncing,
    syncError,
    settings,
    bankAvailable,
    handleChange,
    handleApplyVoucher,
    handleSubmitOrder,
  } = checkout;
  const money = (value: number) => `${value.toLocaleString("vi-VN")} ₫`;
  const field = (
    name: keyof typeof form,
    title: string,
    type = "text",
    required = true,
    autocomplete?: string
  ) => (
    <label className="field">
      {title}
      {required ? " *" : ""}
      <input
        name={name}
        type={type}
        value={String(form[name])}
        onChange={handleChange}
        required={required}
        autoComplete={autocomplete}
        maxLength={name === "address" ? 250 : 100}
      />
    </label>
  );
  return (
    <ClientLayout>
      <div className="store-container section-space">
        <Link className="text-link" to="/shop/category/all">
          <ArrowLeft size={15} />
          Tiếp tục mua sắm
        </Link>
        <div className="section-heading" style={{ marginTop: 24 }}>
          <div>
            <p className="eyebrow">HOÀN TẤT ĐƠN HÀNG</p>
            <h1>Thanh toán</h1>
          </div>
          <LockKeyhole size={22} strokeWidth={1.4} />
        </div>
        {!items.length ? (
          <RequestState
            loading={isSyncing || isSubmitting}
            empty="Giỏ hàng của bạn đang trống."
          />
        ) : (
          <form className="checkout-grid" onSubmit={handleSubmitOrder}>
            <div>
              <section className="form-section" style={{ paddingTop: 0 }}>
                <h2>01. Thông tin người nhận</h2>
                <div className="form-grid">
                  {field("firstName", "Họ", "text", true, "family-name")}
                  {field("lastName", "Tên", "text", true, "given-name")}
                  {field("email", "Email", "email", true, "email")}
                  {field("phone", "Số điện thoại", "tel", true, "tel")}
                  <div className="field full">
                    {field(
                      "address",
                      "Địa chỉ",
                      "text",
                      true,
                      "street-address"
                    )}
                  </div>
                  {field("apartment", "Căn hộ / tầng", "text", false)}
                  {field("city", "Phường / xã", "text", true, "address-level2")}
                  {field(
                    "province",
                    "Tỉnh / thành phố",
                    "text",
                    true,
                    "address-level1"
                  )}
                  {field(
                    "zipCode",
                    "Mã bưu chính",
                    "text",
                    false,
                    "postal-code"
                  )}
                </div>
              </section>
              <section className="form-section">
                <h2>02. Phương thức giao hàng</h2>
                {(["standard", "express"] as const).map((method) => (
                  <label className="radio-option" key={method}>
                    <input
                      type="radio"
                      name="shippingMethod"
                      value={method}
                      checked={form.shippingMethod === method}
                      onChange={handleChange}
                    />
                    <span>
                      {method === "standard" ? "Giao tiêu chuẩn" : "Giao nhanh"}
                    </span>
                    <strong>
                      {subtotal >= settings.freeShippingThreshold
                        ? "Miễn phí"
                        : money(
                            method === "standard"
                              ? settings.standardShipping
                              : settings.expressShipping
                          )}
                    </strong>
                  </label>
                ))}
              </section>
              <section className="form-section">
                <h2>03. Thanh toán</h2>
                <label className="radio-option">
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="cod"
                    checked={form.paymentMethod === "cod"}
                    onChange={handleChange}
                  />
                  <span>
                    Thanh toán khi nhận hàng
                    <small>Trả tiền cho đơn vị giao hàng (COD)</small>
                  </span>
                </label>
                {bankAvailable && (
                  <label className="radio-option">
                    <input
                      type="radio"
                      name="paymentMethod"
                      value="bank_transfer"
                      checked={form.paymentMethod === "bank_transfer"}
                      onChange={handleChange}
                    />
                    <span>
                      Chuyển khoản ngân hàng
                      <small>
                        Thông tin chuyển khoản có trong chi tiết đơn hàng
                      </small>
                    </span>
                  </label>
                )}
              </section>
            </div>
            <aside className="checkout-summary">
              <h2>Đơn hàng của bạn</h2>
              {items.map((item) => (
                <div className="cart-line" key={item.id}>
                  <img
                    src={item.image || urlUtils.getFallbackImageUrl()}
                    alt={item.name}
                  />
                  <div className="cart-line-main">
                    <Link to={`/shop/product/${item.productId}`}>
                      {item.name}
                    </Link>
                    <small>{item.variant}</small>
                    <small>Số lượng: {item.quantity}</small>
                  </div>
                  <strong>{money(item.price * item.quantity)}</strong>
                </div>
              ))}
              <div className="voucher-input">
                <input
                  name="discountCode"
                  aria-label="Mã ưu đãi"
                  placeholder="Mã ưu đãi"
                  value={form.discountCode}
                  onChange={handleChange}
                />
                <button
                  className="button secondary"
                  type="button"
                  disabled={
                    applyingVoucher || isSyncing || !form.discountCode.trim()
                  }
                  onClick={handleApplyVoucher}
                >
                  {applyingVoucher ? "Đang kiểm tra" : "Áp dụng"}
                </button>
              </div>
              {voucher && (
                <p className="success-text">Đã áp dụng {voucher.voucherCode}</p>
              )}
              <div className="totals">
                <div>
                  <span>Tạm tính</span>
                  <span>{money(subtotal)}</span>
                </div>
                <div>
                  <span>Vận chuyển</span>
                  <span>{shippingFee ? money(shippingFee) : "Miễn phí"}</span>
                </div>
                {discount > 0 && (
                  <div>
                    <span>Ưu đãi</span>
                    <span>-{money(discount)}</span>
                  </div>
                )}
                <div>
                  <strong>Tổng thanh toán</strong>
                  <strong>{money(total)}</strong>
                </div>
              </div>
              {syncError && <p className="error-banner">{syncError}</p>}
              {checkout.settingsError && (
                <div className="error-banner">
                  Không tải được phí giao hàng.
                  <button
                    type="button"
                    onClick={() => checkout.retrySettings()}
                  >
                    Thử lại
                  </button>
                </div>
              )}
              <button
                className="button full"
                disabled={
                  isSubmitting ||
                  isSyncing ||
                  !!syncError ||
                  checkout.settingsLoading ||
                  checkout.settingsError
                }
              >
                {isSubmitting ? "Đang đặt hàng..." : "Đặt hàng"}
                <ArrowRight size={17} />
              </button>
              <p className="muted" style={{ marginTop: 15, fontSize: 11 }}>
                Thông tin giao hàng được sử dụng để xử lý đơn hàng theo{" "}
                <Link className="underline" to="/shop/privacy">
                  chính sách quyền riêng tư
                </Link>
                .
              </p>
            </aside>
          </form>
        )}
      </div>
    </ClientLayout>
  );
}
