import React, { useState } from 'react';
import { ShoppingCart, Search, User, Menu, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../../../features/cart/context/cart-context';
import { urlUtils } from '../../../config/api_cli.config';

interface CategoryType {
  _id: string;
  name: string;
  slug: string;
}

interface CartItem {
  id: string;
  name: string;
  price: number;
  image?: string;
  variant?: string;
  quantity: number;
}

interface ClientHeaderProps {
  categories: CategoryType[];
}

const ClientHeader: React.FC<ClientHeaderProps> = ({ categories }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showCart, setShowCart] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();
  const { items, totalItems, subtotal, removeItem, updateQuantity } = useCart();

  const topCategories = categories.slice(0, 4);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/shop/category/all?search=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  return (
    <>
      {/* Promo bar */}
      <div className="bg-gray-800 text-white text-center text-sm py-2 px-4 flex justify-between">
        <div>Nhận 460K · Ưu đãi</div>
        <div className="hidden md:flex items-center space-x-6">
          <span>Tiết kiệm 3.4 triệu cho Bộ Nồi Chảo. <span className="underline font-medium cursor-pointer">Mua Ngay</span></span>
        </div>
        <div className="flex items-center space-x-4">
          <span className="cursor-pointer">Cửa hàng</span>
          <span className="cursor-pointer">Hỗ trợ</span>
        </div>
      </div>

      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-40">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <button className="md:hidden" onClick={() => setIsMenuOpen(!isMenuOpen)}>
              {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>

            <div className="text-2xl font-serif cursor-pointer" onClick={() => navigate('/shop/home')}>
              <h1 className="font-bold">Kitchen E</h1>
            </div>

            <nav className="hidden md:flex items-center space-x-8">
              {topCategories.map(cat => (
                <button
                  key={cat._id}
                  className="hover:underline uppercase text-sm font-medium"
                  onClick={() => navigate(`/shop/category/${cat._id}`)}
                >
                  {cat.name}
                </button>
              ))}
              {topCategories.length === 0 && (
                <>
                  <button className="hover:underline">NỒI CHẢO</button>
                  <button className="hover:underline">DỤNG CỤ NƯỚNG</button>
                  <button className="hover:underline">THIẾT BỊ</button>
                  <button className="hover:underline">BÀN ĂN</button>
                </>
              )}
            </nav>

            <div className="flex items-center space-x-4">
              <form onSubmit={handleSearch} className="hidden md:flex items-center border rounded-full px-3 py-1">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Tìm kiếm..."
                  className="outline-none text-sm w-32"
                />
                <button type="submit"><Search size={16} /></button>
              </form>
              <button onClick={() => navigate('/shop/account')}>
                <User size={20} />
              </button>
              <button onClick={() => setShowCart(!showCart)} className="relative">
                <ShoppingCart size={20} />
                {totalItems > 0 && (
                  <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                    {totalItems}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile menu */}
      {isMenuOpen && (
        <div className="fixed inset-0 bg-white z-50 p-4 overflow-y-auto">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold">Menu</h2>
            <button onClick={() => setIsMenuOpen(false)}><X size={24} /></button>
          </div>
          <nav className="space-y-4">
            {categories.map(cat => (
              <button
                key={cat._id}
                className="block w-full text-left py-2 border-b uppercase"
                onClick={() => { navigate(`/shop/category/${cat._id}`); setIsMenuOpen(false); }}
              >
                {cat.name}
              </button>
            ))}
            <button
              className="block w-full text-left py-2 border-b"
              onClick={() => { navigate('/shop/account'); setIsMenuOpen(false); }}
            >
              Tài khoản
            </button>
          </nav>
        </div>
      )}

      {/* Cart sidebar */}
      {showCart && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-end">
          <div className="bg-white w-full max-w-md p-6 overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold">Giỏ hàng {totalItems > 0 ? `(${totalItems})` : ''}</h2>
              <button onClick={() => setShowCart(false)}><X size={24} /></button>
            </div>

            {items.length === 0 ? (
              <div className="text-center py-12">
                <p className="mb-4">Giỏ hàng của bạn đang trống</p>
                <button
                  className="bg-[#b75e41] text-white px-6 py-3 rounded-md"
                  onClick={() => setShowCart(false)}
                >
                  Tiếp tục mua sắm
                </button>
              </div>
            ) : (
              <>
                <div className="border-t border-b py-2 mb-4">
                  <p className="text-green-600 text-sm">Chúc mừng! Bạn được miễn phí vận chuyển tiêu chuẩn</p>
                </div>
                {items.map((item: CartItem) => (
                  <div key={item.id} className="flex border-b py-4">
                    <img
                      src={item.image || urlUtils.getFallbackImageUrl()}
                      alt={item.name}
                      className="w-20 h-20 object-cover mr-4 rounded"
                    />
                    <div className="flex-1">
                      <h3 className="font-medium">{item.name}</h3>
                      {item.variant && <p className="text-gray-500 text-sm">{item.variant}</p>}
                      <div className="flex items-center mt-2">
                        <button
                          className="border rounded-md px-2"
                          onClick={() => updateQuantity(item.id, item.quantity - 1)}
                        >-</button>
                        <span className="mx-2">{item.quantity}</span>
                        <button
                          className="border rounded-md px-2"
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                        >+</button>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{item.price.toLocaleString()}₫</p>
                      <button
                        className="text-gray-500 text-sm underline mt-2"
                        onClick={() => removeItem(item.id)}
                      >Xóa</button>
                    </div>
                  </div>
                ))}
                <div className="mt-6 space-y-4">
                  <div className="flex justify-between">
                    <span>Tổng phụ</span>
                    <span className="font-medium">{subtotal.toLocaleString()}₫</span>
                  </div>
                  <div className="flex justify-between text-sm text-gray-500">
                    <span>Phí vận chuyển</span>
                    <span>Được tính khi thanh toán</span>
                  </div>
                  <button
                    className="w-full bg-[#b75e41] text-white py-3 rounded-md font-medium"
                    onClick={() => { setShowCart(false); navigate('/shop/checkout'); }}
                  >
                    Thanh toán
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default ClientHeader;
