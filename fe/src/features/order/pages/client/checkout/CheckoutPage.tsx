import React from 'react';
import { ChevronLeft, Check, Lock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useCheckout } from '../../../hooks/useCheckout';

const CheckoutPage: React.FC = () => {
  const navigate = useNavigate();
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
    handleChange,
    handleApplyVoucher,
    handleSubmitOrder,
  } = useCheckout();

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-[#f8f5f2] flex items-center justify-center">
        <div className="text-center">
          <p className="text-xl text-gray-600 mb-4">Giỏ hàng của bạn đang trống.</p>
          <button
            onClick={() => navigate('/shop/home')}
            className="bg-[#b75e41] text-white px-6 py-3 rounded-md hover:bg-[#a34e32]"
          >
            Tiếp tục mua sắm
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#f8f5f2] min-h-screen">
      <div className="bg-white py-4 shadow-sm mb-6">
        <div className="container mx-auto px-4">
          <div className="flex items-center">
            <button
              onClick={() => navigate(-1)}
              className="flex items-center text-gray-600 hover:text-gray-900"
            >
              <ChevronLeft size={20} />
              <span className="ml-1">Quay lại</span>
            </button>
            <h1 className="text-2xl font-serif font-bold text-center mx-auto">Thanh toán</h1>
            <div className="w-24" />
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 pb-16">
        <form onSubmit={handleSubmitOrder}>
          <div className="flex flex-col lg:flex-row gap-8">
            {/* Left — shipping & payment */}
            <div className="lg:w-3/5 space-y-6">
              {/* Contact */}
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h2 className="text-xl font-medium mb-4">Thông tin liên hệ</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Họ *</label>
                    <input type="text" name="firstName" value={form.firstName} onChange={handleChange} required
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tên *</label>
                    <input type="text" name="lastName" value={form.lastName} onChange={handleChange} required
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                    <input type="email" name="email" value={form.email} onChange={handleChange} required
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Số điện thoại *</label>
                    <input type="tel" name="phone" value={form.phone} onChange={handleChange} required
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                </div>
              </div>

              {/* Shipping address */}
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h2 className="text-xl font-medium mb-4">Địa chỉ giao hàng</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Địa chỉ *</label>
                    <input type="text" name="address" value={form.address} onChange={handleChange} required
                      placeholder="Số nhà, tên đường"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Căn hộ, tầng (tuỳ chọn)</label>
                    <input type="text" name="apartment" value={form.apartment} onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Thành phố *</label>
                      <input type="text" name="city" value={form.city} onChange={handleChange} required
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Tỉnh/TP *</label>
                      <select name="province" value={form.province} onChange={handleChange} required
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                        <option value="">Chọn tỉnh/thành phố</option>
                        <option>Hà Nội</option>
                        <option>TP. Hồ Chí Minh</option>
                        <option>Đà Nẵng</option>
                        <option>Thanh Hóa</option>
                        <option>Cần Thơ</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Mã bưu điện</label>
                      <input type="text" name="zipCode" value={form.zipCode} onChange={handleChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Shipping method */}
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h2 className="text-xl font-medium mb-4">Phương thức vận chuyển</h2>
                <div className="space-y-3">
                  <label className="flex items-center p-4 border rounded-md cursor-pointer hover:bg-gray-50">
                    <input type="radio" name="shippingMethod" value="standard"
                      checked={form.shippingMethod === 'standard'} onChange={handleChange}
                      className="h-4 w-4 text-blue-600" />
                    <div className="ml-3 flex-1">
                      <span className="block font-medium">Tiêu chuẩn (MIỄN PHÍ)</span>
                      <span className="block text-sm text-gray-500">3-6 ngày làm việc</span>
                    </div>
                    <span className="text-green-600 font-medium">Miễn phí</span>
                  </label>
                  <label className="flex items-center p-4 border rounded-md cursor-pointer hover:bg-gray-50">
                    <input type="radio" name="shippingMethod" value="express"
                      checked={form.shippingMethod === 'express'} onChange={handleChange}
                      className="h-4 w-4 text-blue-600" />
                    <div className="ml-3 flex-1">
                      <span className="block font-medium">Nhanh</span>
                      <span className="block text-sm text-gray-500">1-2 ngày làm việc</span>
                    </div>
                    <span className="font-medium">50.000₫</span>
                  </label>
                </div>
              </div>

              {/* Payment method */}
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h2 className="text-xl font-medium mb-4">Phương thức thanh toán</h2>
                <div className="space-y-3">
                  <label className="flex items-center p-4 border rounded-md cursor-pointer hover:bg-gray-50">
                    <input type="radio" name="paymentMethod" value="cod"
                      checked={form.paymentMethod === 'cod'} onChange={handleChange}
                      className="h-4 w-4 text-blue-600" />
                    <div className="ml-3">
                      <span className="block font-medium">Thanh toán khi nhận hàng (COD)</span>
                      <span className="block text-sm text-gray-500">Thanh toán bằng tiền mặt khi nhận hàng</span>
                    </div>
                  </label>
                  <label className="flex items-center p-4 border rounded-md cursor-pointer hover:bg-gray-50">
                    <input type="radio" name="paymentMethod" value="bank_transfer"
                      checked={form.paymentMethod === 'bank_transfer'} onChange={handleChange}
                      className="h-4 w-4 text-blue-600" />
                    <div className="ml-3">
                      <span className="block font-medium">Chuyển khoản ngân hàng</span>
                      <span className="block text-sm text-gray-500">Chuyển khoản trước khi giao hàng</span>
                    </div>
                  </label>
                </div>
              </div>
            </div>

            {/* Right — order summary */}
            <div className="lg:w-2/5">
              <div className="bg-white rounded-lg shadow-sm p-6 sticky top-6">
                <h2 className="text-xl font-medium mb-4">Tổng quan đơn hàng</h2>

                {/* Cart items */}
                <div className="border-b pb-4 mb-4 space-y-3">
                  {items.map((item) => (
                    <div key={item.id} className="flex gap-3">
                      <div className="relative bg-gray-100 rounded w-16 h-16 flex-shrink-0">
                        {item.image && (
                          <img src={item.image} alt={item.name} className="w-full h-full object-contain p-1 rounded" />
                        )}
                        <span className="absolute -top-1.5 -right-1.5 bg-gray-700 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">
                          {item.quantity}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{item.name}</p>
                        {item.variant && <p className="text-xs text-gray-500">{item.variant}</p>}
                      </div>
                      <span className="text-sm font-medium whitespace-nowrap">
                        {(item.price * item.quantity).toLocaleString()}₫
                      </span>
                    </div>
                  ))}
                </div>

                {/* Voucher */}
                <div className="mb-4">
                  <div className="flex">
                    <input
                      type="text"
                      name="discountCode"
                      value={form.discountCode}
                      onChange={handleChange}
                      placeholder="Mã giảm giá"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-l-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    />
                    <button
                      type="button"
                      onClick={handleApplyVoucher}
                      disabled={applyingVoucher || !form.discountCode.trim()}
                      className="bg-gray-800 text-white px-4 py-2 rounded-r-md hover:bg-gray-700 text-sm disabled:opacity-50"
                    >
                      {applyingVoucher ? '...' : 'Áp dụng'}
                    </button>
                  </div>
                  {voucher && (
                    <div className="flex items-center text-green-600 bg-green-50 p-2 rounded-md mt-2 text-sm">
                      <Check size={14} className="mr-1 flex-shrink-0" />
                      Giảm {voucher.discountAmount.toLocaleString()}₫
                    </div>
                  )}
                </div>

                {/* Totals */}
                <div className="space-y-2 mb-6 text-sm">
                  <div className="flex justify-between">
                    <span>Tạm tính</span>
                    <span>{subtotal.toLocaleString()}₫</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Phí vận chuyển</span>
                    <span>{shippingFee > 0 ? `${shippingFee.toLocaleString()}₫` : 'Miễn phí'}</span>
                  </div>
                  {discount > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span>Giảm giá</span>
                      <span>-{discount.toLocaleString()}₫</span>
                    </div>
                  )}
                  <div className="border-t pt-2 flex justify-between font-bold text-base">
                    <span>Tổng cộng</span>
                    <span>{total.toLocaleString()}₫</span>
                  </div>
                </div>

                <p className="text-xs text-gray-500 mb-4">
                  Bằng cách nhấn "Đặt hàng", bạn đồng ý với{' '}
                  <a href="#" className="underline">Điều khoản dịch vụ</a> và{' '}
                  <a href="#" className="underline">Chính sách bảo mật</a>.
                </p>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-[#b75e41] text-white py-3 rounded-md font-medium flex items-center justify-center hover:bg-[#a34e32] disabled:opacity-60"
                >
                  <Lock size={16} className="mr-2" />
                  {isSubmitting ? 'Đang xử lý...' : `ĐẶT HÀNG (${total.toLocaleString()}₫)`}
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CheckoutPage;
