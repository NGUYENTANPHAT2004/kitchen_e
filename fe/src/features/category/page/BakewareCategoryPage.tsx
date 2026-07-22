import React from 'react';
import { ChevronRight } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useCart } from '../../cart/context/cart-hook';
import { productService } from '../../products/services/productService';
import { categoryService } from '../service/categoryService';
import { urlUtils } from '../../../config/api_cli.config';
import type { Product } from '../../products/services/productService';
import ClientLayout from '../../../components/layout/client/ClientLayout';

interface CategoryType {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  image?: string;
  isActive: boolean;
  isDeleted: boolean;
  children?: CategoryType[];
}

const FALLBACK_BANNER = 'https://i.imgur.com/9RklDJh.jpg';
const FALLBACK_PRODUCT = 'https://i.imgur.com/JYD8WVS.jpg';

const BakewareCategoryPage: React.FC = () => {
  const { categoryId } = useParams<{ categoryId: string }>();
  const navigate = useNavigate();
  const { addItem } = useCart();

  const { data: categoriesRaw } = useQuery({
    queryKey: ['categories-client'],
    queryFn: () => categoryService.getCategories(),
    staleTime: 10 * 60 * 1000,
  });
  const allCategories: CategoryType[] = Array.isArray(categoriesRaw) ? categoriesRaw : [];
  const currentCategory = allCategories.find(c => c._id === categoryId);

  const { data: productsData, isLoading } = useQuery({
    queryKey: ['products-by-category', categoryId],
    queryFn: () =>
      productService.getProducts({
        ...(categoryId && categoryId !== 'all' ? { category: categoryId } : {}),
        limit: 24,
        sort: '-createdAt',
      }),
    staleTime: 5 * 60 * 1000,
  });

  const products: Product[] = productsData?.data?.products || productsData?.products || [];

  const handleAddToCart = (product: Product) => {
    const img = product.images?.find(i => i.isDefault)?.url || product.images?.[0]?.url || '';
    addItem({
      id: product._id,
      productId: product._id,
      name: product.name,
      price: product.basePrice,
      image: urlUtils.getFullImageUrl(img) || '',
      variant: '',
    });
  };

  const bannerImage = urlUtils.getFullImageUrl(currentCategory?.image) || FALLBACK_BANNER;

  return (
    <ClientLayout>
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar */}
          <aside className="lg:w-1/5 shrink-0">
            <nav className="space-y-1">
              <button
                className={`block text-left w-full py-2 px-3 rounded-md text-sm transition-colors ${
                  !categoryId || categoryId === 'all'
                    ? 'bg-gray-100 font-bold text-gray-900'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
                onClick={() => navigate('/shop/category/all')}
              >
                Tất cả sản phẩm
              </button>
              {allCategories.map(cat => (
                <button
                  key={cat._id}
                  className={`block text-left w-full py-2 px-3 rounded-md text-sm uppercase transition-colors ${
                    cat._id === categoryId
                      ? 'bg-gray-100 font-bold text-gray-900'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                  onClick={() => navigate(`/shop/category/${cat._id}`)}
                >
                  {cat.name}
                </button>
              ))}
            </nav>
          </aside>

          {/* Main content */}
          <div className="flex-1 min-w-0">
            {/* Breadcrumb */}
            <div className="flex items-center text-sm mb-6 text-gray-500">
              <button className="hover:underline hover:text-gray-800" onClick={() => navigate('/shop/home')}>
                Trang chủ
              </button>
              <ChevronRight size={14} className="mx-1" />
              <span className="font-medium text-gray-800">
                {currentCategory?.name || 'Tất cả sản phẩm'}
              </span>
            </div>

            {/* Hero Banner */}
            <div className="flex flex-col md:flex-row bg-[#f8f8f6] rounded-xl overflow-hidden mb-10">
              <div className="md:w-1/2 p-8 flex flex-col justify-center">
                <h1 className="text-3xl font-serif font-bold mb-3">
                  {currentCategory?.name || 'Tất Cả Sản Phẩm'}
                </h1>
                <p className="text-gray-600 text-sm leading-relaxed">
                  {currentCategory?.description ||
                    `Khám phá bộ sưu tập ${currentCategory?.name || 'sản phẩm'} chất lượng cao của chúng tôi.`}
                </p>
              </div>
              <div className="md:w-1/2 h-48 md:h-auto">
                <img
                  src={bannerImage}
                  alt={currentCategory?.name || 'Sản phẩm'}
                  className="w-full h-full object-cover"
                  onError={e => { (e.target as HTMLImageElement).src = FALLBACK_BANNER; }}
                />
              </div>
            </div>

            {/* Product count */}
            <p className="text-sm text-gray-500 mb-6">{products.length} sản phẩm</p>

            {/* Product Grid */}
            {isLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="animate-pulse">
                    <div className="bg-gray-200 rounded-xl h-64 mb-4" />
                    <div className="bg-gray-200 h-4 rounded mb-2 w-3/4" />
                    <div className="bg-gray-200 h-4 rounded w-1/2" />
                  </div>
                ))}
              </div>
            ) : products.length === 0 ? (
              <div className="text-center py-20 text-gray-500">
                <p className="text-lg mb-4">Không có sản phẩm nào trong danh mục này.</p>
                <button
                  className="text-[#b75e41] underline text-sm"
                  onClick={() => navigate('/shop/category/all')}
                >
                  Xem tất cả sản phẩm
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {products.map(product => {
                  const defaultImg =
                    product.images?.find(i => i.isDefault)?.url || product.images?.[0]?.url;
                  const imageUrl = urlUtils.getFullImageUrl(defaultImg) || FALLBACK_PRODUCT;

                  return (
                    <div key={product._id} className="group cursor-pointer">
                      {product.featured && (
                        <div className="inline-block bg-gray-800 text-white text-xs px-2 py-1 mb-2 rounded">
                          BÁN CHẠY
                        </div>
                      )}

                      <div
                        className="relative bg-[#f8f8f6] rounded-xl mb-4 overflow-hidden aspect-square"
                        onClick={() => navigate(`/shop/product/${product._id}`)}
                      >
                        <img
                          src={imageUrl}
                          alt={product.name}
                          className="w-full h-full object-contain p-4 transition-transform duration-300 group-hover:scale-105"
                          onError={e => { (e.target as HTMLImageElement).src = FALLBACK_PRODUCT; }}
                        />
                      </div>

                      <h3
                        className="font-medium text-base mb-1 hover:underline line-clamp-2"
                        onClick={() => navigate(`/shop/product/${product._id}`)}
                      >
                        {product.name}
                      </h3>
                      <p className="text-gray-500 text-sm mb-3 line-clamp-2">{product.description}</p>

                      <div className="flex items-center justify-between">
                        <span className="font-semibold">{product.basePrice.toLocaleString('vi-VN')}₫</span>
                        <button
                          className="bg-gray-800 text-white px-4 py-1.5 rounded-lg text-sm hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          onClick={() => handleAddToCart(product)}
                          disabled={product.stockQuantity === 0}
                        >
                          {product.stockQuantity === 0 ? 'Hết hàng' : 'Thêm vào giỏ'}
                        </button>
                      </div>

                      {product.tags && product.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-3">
                          {product.tags.slice(0, 3).map(tag => (
                            <span
                              key={tag}
                              className="text-xs border border-gray-200 rounded-full px-2 py-0.5 text-gray-500"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </ClientLayout>
  );
};

export default BakewareCategoryPage;
