import React from 'react';
import { Heart, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useCart } from '../../features/cart/context/cart-hook';
import { productService } from '../../features/products/services/productService';
import { categoryService } from '../../features/category/service/categoryService';
import { urlUtils } from '../../config/api_cli.config';
import type { Product } from '../../features/products/services/productService';
import ClientLayout from './client/ClientLayout';
import { useCategories } from './client/categories-context';

const FALLBACK_PRODUCT = 'https://i.imgur.com/WLUKr0K.jpg';
const FALLBACK_CATEGORY = 'https://i.imgur.com/CXBkVJW.jpg';

const Clientsetup: React.FC = () => {
  const navigate = useNavigate();
  const { addItem } = useCart();

  const { data: featuredData, isLoading: loadingFeatured } = useQuery({
    queryKey: ['featured-products', 8],
    queryFn: () => productService.getFeaturedProducts(8),
    staleTime: 5 * 60 * 1000,
  });

  const { data: newestData, isLoading: loadingNewest } = useQuery({
    queryKey: ['newest-products', 8],
    queryFn: () => productService.getProducts({ limit: 8, sort: '-createdAt' }),
    staleTime: 5 * 60 * 1000,
  });

  const { data: categoriesData, isLoading: loadingCategories } = useQuery({
    queryKey: ['categories-client'],
    queryFn: () => categoryService.getCategories(),
    staleTime: 10 * 60 * 1000,
  });

  const featuredProducts: Product[] = featuredData?.data?.products || featuredData?.products || [];
  const newestProducts: Product[] = newestData?.data?.products || newestData?.products || [];
  const categories = useCategories();
  const allCategories: any[] = (categoriesData as any[]) || categories;
  const topCategories = allCategories.filter(c => c.isActive && !c.isDeleted).slice(0, 4);

  const handleAddToCart = (product: Product) => {
    const image = product.images?.find(img => img.isDefault)?.url || product.images?.[0]?.url || '';
    addItem({
      id: product._id,
      productId: product._id,
      name: product.name,
      price: product.basePrice,
      image: urlUtils.getFullImageUrl(image) || '',
      variant: '',
    });
  };

  const ProductCard: React.FC<{ product: Product }> = ({ product }) => {
    const defaultImage = product.images?.find(img => img.isDefault)?.url || product.images?.[0]?.url;
    const imageUrl = urlUtils.getFullImageUrl(defaultImage) || FALLBACK_PRODUCT;

    return (
      <div className="bg-white rounded-xl overflow-hidden group">
        {product.featured && (
          <div className="bg-gray-800 text-white text-xs px-2 py-1 inline-block absolute top-2 left-2 rounded z-10">
            BÁN CHẠY NHẤT
          </div>
        )}
        <div
          className="relative bg-[#f8f6f3] cursor-pointer aspect-square overflow-hidden"
          onClick={() => navigate(`/shop/product/${product._id}`)}
        >
          <img
            src={imageUrl}
            alt={product.name}
            className="w-full h-full object-contain p-4 transition-transform duration-300 group-hover:scale-105"
            onError={e => { (e.target as HTMLImageElement).src = FALLBACK_PRODUCT; }}
          />
          <button className="absolute top-2 right-2 text-gray-400 hover:text-red-500 transition-colors">
            <Heart size={18} />
          </button>
        </div>
        <div className="p-4">
          <h3
            className="font-medium text-sm mb-1 cursor-pointer hover:underline line-clamp-2"
            onClick={() => navigate(`/shop/product/${product._id}`)}
          >
            {product.name}
          </h3>
          <p className="text-gray-500 text-xs mb-3 line-clamp-2">{product.description}</p>
          <div className="flex items-center justify-between">
            <span className="font-semibold text-sm">{product.basePrice.toLocaleString('vi-VN')}₫</span>
            <button
              className="bg-gray-800 text-white px-3 py-1.5 rounded-lg text-xs hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              onClick={() => handleAddToCart(product)}
              disabled={product.stockQuantity === 0}
            >
              {product.stockQuantity === 0 ? 'Hết hàng' : 'Thêm'}
            </button>
          </div>
        </div>
      </div>
    );
  };

  const ProductSkeletons = () => (
    <>
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="bg-white rounded-xl overflow-hidden animate-pulse">
          <div className="bg-gray-200 aspect-square" />
          <div className="p-4">
            <div className="bg-gray-200 h-4 rounded mb-2 w-3/4" />
            <div className="bg-gray-200 h-3 rounded mb-3 w-full" />
            <div className="flex justify-between items-center">
              <div className="bg-gray-200 h-4 rounded w-1/3" />
              <div className="bg-gray-200 h-7 rounded w-1/4" />
            </div>
          </div>
        </div>
      ))}
    </>
  );

  return (
    <ClientLayout>
      {/* Hero Banner */}
      <section className="bg-[#e8e0d7] overflow-hidden">
        <div className="container mx-auto px-4 py-12 md:py-20">
          <div className="flex flex-col md:flex-row md:items-center gap-8">
            <div className="md:w-1/2">
              <p className="text-sm uppercase tracking-widest text-gray-500 mb-3">Bộ sưu tập mới</p>
              <h1 className="text-4xl md:text-5xl font-serif font-bold mb-4 leading-tight">
                Dụng Cụ Nhà Bếp<br />Đa Năng
              </h1>
              <p className="text-gray-600 mb-8 text-lg">
                Sản phẩm nhà bếp nổi bật, hiệu quả, không chứa hóa chất độc hại.
              </p>
              <div className="flex gap-3">
                <button
                  className="bg-[#b75e41] text-white px-6 py-3 rounded-lg font-medium hover:bg-[#a0512e] transition-colors"
                  onClick={() => navigate('/shop/category/' + (topCategories[0]?._id || 'all'))}
                >
                  Mua Ngay
                </button>
                <button
                  className="border border-gray-400 text-gray-700 px-6 py-3 rounded-lg font-medium hover:bg-white transition-colors"
                  onClick={() => navigate('/shop/category/all')}
                >
                  Xem tất cả
                </button>
              </div>
            </div>
            <div className="md:w-1/2">
              <img
                src="https://i.imgur.com/1hDUYym.jpg"
                alt="Bộ sưu tập nồi chảo"
                className="w-full h-auto rounded-2xl shadow-lg object-cover max-h-96 md:max-h-none"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Category Section */}
      <section className="py-14 bg-white">
        <div className="container mx-auto px-4">
          <div className="flex justify-between items-center mb-8">
            <h2 className="text-2xl font-serif font-bold">Danh Mục Sản Phẩm</h2>
            <button
              className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 transition-colors"
              onClick={() => navigate('/shop/category/all')}
            >
              Xem tất cả <ArrowRight size={14} />
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {loadingCategories
              ? Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="animate-pulse">
                    <div className="bg-gray-200 rounded-xl aspect-square mb-3" />
                    <div className="bg-gray-200 h-4 rounded w-2/3 mx-auto" />
                  </div>
                ))
              : topCategories.map(cat => (
                  <div
                    key={cat._id}
                    className="group cursor-pointer"
                    onClick={() => navigate(`/shop/category/${cat._id}`)}
                  >
                    <div className="relative overflow-hidden rounded-xl mb-3 aspect-square bg-[#f8f5f2]">
                      <img
                        src={urlUtils.getFullImageUrl((cat as any).image || (cat as any).imagePath) || FALLBACK_CATEGORY}
                        alt={cat.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        onError={e => { (e.target as HTMLImageElement).src = FALLBACK_CATEGORY; }}
                      />
                    </div>
                    <h3 className="text-base font-medium text-center">{cat.name}</h3>
                  </div>
                ))
            }
          </div>
        </div>
      </section>

      {/* Featured Products */}
      <section className="py-14 bg-[#f8f5f2]">
        <div className="container mx-auto px-4">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h2 className="text-2xl font-serif font-bold">Sản Phẩm Nổi Bật</h2>
              <p className="text-sm text-gray-500 mt-1">Những sản phẩm được yêu thích nhất</p>
            </div>
            <button
              className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 transition-colors"
              onClick={() => navigate('/shop/category/all')}
            >
              Xem tất cả <ArrowRight size={14} />
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
            {loadingFeatured ? <ProductSkeletons /> : featuredProducts.slice(0, 8).map(p => (
              <div key={p._id} className="relative">
                <ProductCard product={p} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Newest Products */}
      <section className="py-14 bg-white">
        <div className="container mx-auto px-4">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h2 className="text-2xl font-serif font-bold">Sản Phẩm Mới Nhất</h2>
              <p className="text-sm text-gray-500 mt-1">Vừa được thêm vào cửa hàng</p>
            </div>
            <button
              className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 transition-colors"
              onClick={() => navigate('/shop/category/all')}
            >
              Xem tất cả <ArrowRight size={14} />
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
            {loadingNewest ? <ProductSkeletons /> : newestProducts.slice(0, 8).map(p => (
              <div key={p._id} className="relative">
                <ProductCard product={p} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Banner CTA */}
      <section className="py-16 bg-[#e8e0d7]">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-serif font-bold mb-4">Thiết Kế Đa Năng Độc Quyền</h2>
          <p className="text-gray-600 mb-6 max-w-xl mx-auto">
            Tiết kiệm tiền và không gian tủ bếp với các sản phẩm được thiết kế để làm mọi việc — và hơn thế nữa.
          </p>
          <button
            className="bg-gray-800 text-white px-8 py-3 rounded-lg font-medium hover:bg-gray-700 transition-colors"
            onClick={() => navigate('/shop/category/all')}
          >
            Khám Phá Ngay
          </button>
        </div>
      </section>

      {/* Features */}
      <section className="py-14 bg-white">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
            <div>
              <div className="text-3xl mb-3">🌱</div>
              <h3 className="text-lg font-semibold mb-2">Thân Thiện Môi Trường</h3>
              <p className="text-gray-500 text-sm">Được làm từ 100% nhôm tái chế và không chứa chất độc hại tiềm ẩn.</p>
            </div>
            <div>
              <div className="text-3xl mb-3">🚚</div>
              <h3 className="text-lg font-semibold mb-2">Miễn Phí Vận Chuyển</h3>
              <p className="text-gray-500 text-sm">Miễn phí vận chuyển cho đơn hàng từ 500.000₫ toàn quốc.</p>
            </div>
            <div>
              <div className="text-3xl mb-3">🔄</div>
              <h3 className="text-lg font-semibold mb-2">Đổi Trả 30 Ngày</h3>
              <p className="text-gray-500 text-sm">Không hài lòng? Đổi trả miễn phí trong vòng 30 ngày.</p>
            </div>
          </div>
        </div>
      </section>
    </ClientLayout>
  );
};

export default Clientsetup;
