import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Star, StarHalf, Heart, Plus, Minus } from 'lucide-react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useCart } from '../../../cart/context/cart-hook';
import { productService } from '../../services/productService';
import { customizationService } from '../../../customizations/service/customizationService';
import { urlUtils, api, endpoints } from '../../../../config/api_cli.config';
import type { Variant } from '../../../variants/interfaces/interface';
import type { Customization, CustomizationOption } from '../../../customizations/interface/interface';

type SelectedOption = CustomizationOption & { _id: string };

interface Review {
  _id: string;
  userId: { name: string; avatar?: string };
  rating: number;
  comment: string;
  createdAt: string;
}

class ProductDetailErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 24, color: 'red', fontFamily: 'monospace' }}>
          <strong>Error:</strong> {this.state.error.message}
          <pre style={{ fontSize: 12 }}>{this.state.error.stack}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

const AlwaysPanProductPageInner: React.FC = () => {
  const { id: productId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { addItem } = useCart();

  const [selectedVariant, setSelectedVariant] = useState<Variant | null>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [activeTab, setActiveTab] = useState('details');
  // Lựa chọn customization: map customizationId -> option đang chọn
  const [selectedOptions, setSelectedOptions] = useState<Record<string, SelectedOption>>({});

  // Fetch product
  const { data: productData, isLoading } = useQuery({
    queryKey: ['product', productId],
    queryFn: () => productService.getProduct(productId!),
    enabled: !!productId,
  });

  // Fetch variants
  const { data: variantsData } = useQuery({
    queryKey: ['product-variants', productId],
    queryFn: () => api.get(endpoints.products.variants(productId!)).then(r => r.data),
    enabled: !!productId,
  });

  // Fetch reviews
  const { data: reviewsData } = useQuery({
    queryKey: ['product-reviews', productId],
    queryFn: () => api.get(endpoints.products.reviews(productId!)).then(r => r.data),
    enabled: !!productId,
  });

  // Fetch customizations
  const { data: customizationsData } = useQuery({
    queryKey: ['product-customizations', productId],
    queryFn: () => customizationService.getProductCustomizations(productId!),
    enabled: !!productId,
  });

  // Fetch related products
  const { data: relatedData } = useQuery({
    queryKey: ['featured-products-related'],
    queryFn: () => productService.getFeaturedProducts(4),
    staleTime: 5 * 60 * 1000,
  });

  // Set first variant when variants load
  useEffect(() => {
    const loadedVariants: Variant[] = variantsData?.data?.variants || variantsData?.variants || [];
    if (loadedVariants.length > 0) {
      setSelectedVariant(current => current || loadedVariants[0]);
    }
  }, [variantsData]);

  const product = productData?.data?.product || productData?.data || productData;
  const variants: Variant[] = variantsData?.data?.variants || variantsData?.variants || [];
  const reviews: Review[] = reviewsData?.data?.reviews || reviewsData?.reviews || [];
  const relatedProducts = relatedData?.data?.products || relatedData?.products || [];
  const customizations: Customization[] = (customizationsData || [])
    .filter((c: Customization) => c.isActive && !c.isDeleted)
    .sort((a: Customization, b: Customization) => a.displayOrder - b.displayOrder);

  // Chọn sẵn option mặc định khi customizations tải xong
  useEffect(() => {
    if (!customizations.length) return;
    setSelectedOptions(prev => {
      const next = { ...prev };
      let changed = false;
      customizations.forEach(c => {
        if (next[c._id]) return; // đã chọn thì giữ nguyên
        const def = c.options.find(o => o.isDefault) || (c.isRequired ? c.options[0] : undefined);
        if (def) {
          next[c._id] = def as SelectedOption;
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [customizationsData]); // eslint-disable-line react-hooks/exhaustive-deps

  const activeVariant = selectedVariant || variants[0] || null;

  // Build image list: variant images first, then product images
  const allImages: string[] = [];
  if (activeVariant?.images?.length) {
    activeVariant.images.forEach(img => {
      const url = urlUtils.getFullImageUrl(img.url);
      if (url) allImages.push(url);
    });
  }
  if (product?.images?.length && allImages.length === 0) {
    product.images.forEach((img: any) => {
      const url = urlUtils.getFullImageUrl(img.url);
      if (url) allImages.push(url);
    });
  }
  const fallback = 'https://i.imgur.com/R7Hni84.jpg';
  const displayImages = allImages.length > 0 ? allImages : [fallback];

  // Giá gốc = basePrice sản phẩm + phụ giá variant (shape variant thật dùng priceAdjustment)
  const basePrice = (product?.basePrice || 0) + (activeVariant?.priceAdjustment || 0);
  // Tổng phụ giá từ các option customization đã chọn
  const customizationExtra = Object.values(selectedOptions)
    .reduce((sum, opt) => sum + (opt?.priceAdjustment || 0), 0);
  const currentPrice = basePrice + customizationExtra;
  const comparePrice = product?.compareAtPrice;
  const inStock = activeVariant ? activeVariant.stockQuantity > 0 : (product?.stockQuantity || 0) > 0;

  // Ràng buộc: customization bắt buộc phải được chọn trước khi thêm vào giỏ
  const missingRequired = customizations.filter(c => c.isRequired && !selectedOptions[c._id]);
  const canAddToCart = inStock && missingRequired.length === 0;

  const avgRating = reviews.length
    ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
    : product?.averageRating || 0;

  const handleSelectOption = (customizationId: string, option: CustomizationOption) => {
    setSelectedOptions(prev => ({ ...prev, [customizationId]: option as SelectedOption }));
  };

  const handleAddToCart = () => {
    if (!product || !canAddToCart) return;
    // Gói lựa chọn customization: { [tên customization]: { value, priceAdjustment } }
    const chosen = customizations
      .map(c => ({ c, opt: selectedOptions[c._id] }))
      .filter(x => x.opt);
    const customizationsPayload = chosen.reduce((acc, { c, opt }) => {
      acc[c.name] = { value: opt.value, priceAdjustment: opt.priceAdjustment || 0 };
      return acc;
    }, {} as Record<string, { value: string; priceAdjustment: number }>);
    const customizationLabel = chosen.map(({ c, opt }) => `${c.name}: ${opt.value}`).join(', ');

    const variantLabel = activeVariant
      ? [
          activeVariant.color && `Màu: ${activeVariant.color}`,
          activeVariant.size && `Kích cỡ: ${activeVariant.size}`,
          activeVariant.material && `Chất liệu: ${activeVariant.material}`,
        ].filter(Boolean).join(', ')
      : '';
    const fullLabel = [variantLabel, customizationLabel].filter(Boolean).join(' | ');
    // id giỏ hàng phải phân biệt cả customization đã chọn
    const customizationKey = chosen.map(({ c, opt }) => `${c._id}:${opt.value}`).join('|');
    const cartId = [product._id, activeVariant?._id, customizationKey].filter(Boolean).join('-');

    addItem({
      id: cartId,
      productId: product._id,
      variantId: activeVariant?._id,
      name: product.name,
      price: currentPrice,
      image: displayImages[0],
      customizations: Object.keys(customizationsPayload).length ? customizationsPayload : undefined,
      variant: fullLabel,
      quantity,
    });
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="flex flex-col lg:flex-row gap-8 animate-pulse">
          <div className="lg:w-3/5 bg-gray-200 rounded-lg h-96" />
          <div className="lg:w-2/5 space-y-4">
            <div className="bg-gray-200 h-8 rounded w-3/4" />
            <div className="bg-gray-200 h-6 rounded w-1/2" />
            <div className="bg-gray-200 h-12 rounded" />
            <div className="bg-gray-200 h-12 rounded" />
          </div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="container mx-auto px-4 py-12 text-center">
        <p className="text-gray-500 text-lg">Không tìm thấy sản phẩm.</p>
        <button className="mt-4 text-[#b75e41] underline" onClick={() => navigate('/shop/home')}>
          Về trang chủ
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white">
      {/* Breadcrumb */}
      <div className="container mx-auto px-4 py-4 text-sm">
        <nav className="flex items-center space-x-2 text-gray-600">
          <button className="hover:underline" onClick={() => navigate('/shop/home')}>Trang chủ</button>
          <span>/</span>
          {product.categoryId && typeof product.categoryId === 'object' && (
            <>
              <button
                className="hover:underline"
                onClick={() => navigate(`/shop/category/${product.categoryId._id}`)}
              >
                {product.categoryId.name}
              </button>
              <span>/</span>
            </>
          )}
          <span className="text-gray-900 font-medium">{product.name}</span>
        </nav>
      </div>

      {/* Main product section */}
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Images */}
          <div className="lg:w-3/5">
            <div className="relative">
              <div className="bg-[#f8f6f3] rounded-lg p-8 mb-4 relative overflow-hidden">
                <img
                  src={displayImages[currentImageIndex]}
                  alt={product.name}
                  className="w-full h-auto object-contain mx-auto max-h-96"
                  onError={e => { (e.target as HTMLImageElement).src = fallback; }}
                />
              </div>

              {displayImages.length > 1 && (
                <div className="absolute top-1/2 left-0 transform -translate-y-1/2 w-full flex justify-between px-2 pointer-events-none">
                  <button
                    className="bg-white rounded-full p-2 shadow-md pointer-events-auto"
                    onClick={() => setCurrentImageIndex(i => i === 0 ? displayImages.length - 1 : i - 1)}
                  >
                    <ChevronLeft size={20} />
                  </button>
                  <button
                    className="bg-white rounded-full p-2 shadow-md pointer-events-auto"
                    onClick={() => setCurrentImageIndex(i => i === displayImages.length - 1 ? 0 : i + 1)}
                  >
                    <ChevronRight size={20} />
                  </button>
                </div>
              )}

              {displayImages.length > 1 && (
                <div className="flex justify-center mt-4 space-x-2">
                  {displayImages.map((img, idx) => (
                    <button
                      key={idx}
                      className={`w-16 h-16 rounded-md overflow-hidden border-2 ${idx === currentImageIndex ? 'border-gray-800' : 'border-transparent'}`}
                      onClick={() => setCurrentImageIndex(idx)}
                    >
                      <img src={img} alt={`thumb ${idx + 1}`} className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Product info */}
          <div className="lg:w-2/5">
            {product.featured && (
              <div className="inline-block bg-[#435547] text-white text-xs uppercase tracking-wider px-3 py-1 mb-4">
                Bán chạy nhất
              </div>
            )}

            <h1 className="text-3xl font-serif font-bold mb-1">{product.name}</h1>
            <p className="text-gray-500 text-sm mb-2">SKU: {activeVariant?.sku || product.sku}</p>

            {/* Rating */}
            {avgRating > 0 && (
              <div className="flex items-center mb-4">
                <div className="flex">
                  {[...Array(Math.floor(avgRating))].map((_, i) => (
                    <Star key={i} size={16} fill="#f59e0b" color="#f59e0b" />
                  ))}
                  {avgRating % 1 !== 0 && <StarHalf size={16} fill="#f59e0b" color="#f59e0b" />}
                </div>
                <span className="ml-2 text-sm text-gray-600">({reviews.length} đánh giá)</span>
              </div>
            )}

            {/* Price */}
            <div className="flex items-center mb-6">
              <span className="text-2xl font-medium">{(currentPrice || 0).toLocaleString()}₫</span>
              {comparePrice && comparePrice > currentPrice && (
                <>
                  <span className="ml-2 text-gray-500 line-through">{comparePrice.toLocaleString()}₫</span>
                  <span className="ml-2 text-red-600 text-sm">
                    (-{Math.round((1 - currentPrice / comparePrice) * 100)}%)
                  </span>
                </>
              )}
            </div>

            {/* Variants */}
            {variants.length > 0 && (
              <div className="mb-6">
                <h3 className="font-medium mb-2">Phiên bản:</h3>
                <div className="flex flex-wrap gap-2">
                  {variants.filter(v => !v.isDeleted).map(variant => (
                    <button
                      key={variant._id}
                      className={`border px-4 py-2 rounded-md text-sm ${
                        activeVariant?._id === variant._id
                          ? 'border-gray-800 bg-gray-100 font-medium'
                          : 'border-gray-300 hover:border-gray-500'
                      }`}
                      onClick={() => { setSelectedVariant(variant); setCurrentImageIndex(0); }}
                    >
                      {variant.name}
                    </button>
                  ))}
                </div>

                {/* Variant attributes */}
                {activeVariant && (activeVariant.color || activeVariant.size || activeVariant.material) && (
                  <div className="mt-3 text-sm text-gray-600">
                    {activeVariant.color && (
                      <span className="mr-4"><span className="font-medium">Màu:</span> {activeVariant.color}</span>
                    )}
                    {activeVariant.size && (
                      <span className="mr-4"><span className="font-medium">Kích cỡ:</span> {activeVariant.size}</span>
                    )}
                    {activeVariant.material && (
                      <span className="mr-4"><span className="font-medium">Chất liệu:</span> {activeVariant.material}</span>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Customizations */}
            {customizations.map(c => {
              const selected = selectedOptions[c._id];
              const isMissing = c.isRequired && !selected;
              return (
                <div key={c._id} className="mb-6">
                  <h3 className="font-medium mb-2">
                    {c.name}
                    {c.isRequired && <span className="text-red-500 ml-1">*</span>}
                    {selected && (
                      <span className="ml-2 text-sm font-normal text-gray-500">
                        {selected.value}
                        {selected.priceAdjustment > 0 && ` (+${selected.priceAdjustment.toLocaleString()}₫)`}
                      </span>
                    )}
                  </h3>
                  {c.description && <p className="text-sm text-gray-500 mb-2">{c.description}</p>}
                  <div className="flex flex-wrap gap-2">
                    {c.options.map(option => {
                      const isSelected = selected?.value === option.value;
                      const optImg = urlUtils.getFullImageUrl(option.image);
                      return (
                        <button
                          key={option._id || option.value}
                          className={`flex items-center gap-2 border px-3 py-2 rounded-md text-sm ${
                            isSelected
                              ? 'border-gray-800 bg-gray-100 font-medium'
                              : 'border-gray-300 hover:border-gray-500'
                          }`}
                          onClick={() => handleSelectOption(c._id, option)}
                        >
                          {optImg && (
                            <img src={optImg} alt={option.value} className="w-6 h-6 object-cover rounded" />
                          )}
                          <span>{option.value}</span>
                          {option.priceAdjustment > 0 && (
                            <span className="text-gray-500">+{option.priceAdjustment.toLocaleString()}₫</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                  {isMissing && (
                    <p className="text-sm text-red-500 mt-1">Vui lòng chọn {c.name.toLowerCase()}</p>
                  )}
                </div>
              );
            })}

            {/* Quantity */}
            <div className="mb-6">
              <h3 className="font-medium mb-2">Số lượng:</h3>
              <div className="flex items-center border border-gray-300 rounded-md w-32">
                <button
                  className="px-3 py-2"
                  onClick={() => setQuantity(q => Math.max(1, q - 1))}
                  disabled={quantity <= 1}
                >
                  <Minus size={16} className={quantity <= 1 ? 'text-gray-300' : 'text-gray-600'} />
                </button>
                <span className="flex-1 text-center">{quantity}</span>
                <button className="px-3 py-2" onClick={() => setQuantity(q => q + 1)}>
                  <Plus size={16} />
                </button>
              </div>
              {activeVariant && (
                <p className="text-sm text-gray-500 mt-1">
                  {activeVariant.stockQuantity > 0
                    ? `Còn ${activeVariant.stockQuantity} sản phẩm`
                    : 'Hết hàng'}
                </p>
              )}
            </div>

            {/* Buttons */}
            <div className="mb-6 space-y-3">
              <button
                className="w-full bg-[#b75e41] text-white py-3 rounded-md font-medium disabled:opacity-50"
                onClick={handleAddToCart}
                disabled={!canAddToCart}
              >
                {!inStock
                  ? 'HẾT HÀNG'
                  : missingRequired.length > 0
                    ? 'VUI LÒNG CHỌN TÙY CHỌN'
                    : 'THÊM VÀO GIỎ HÀNG'}
              </button>
              <button className="w-full border border-gray-300 py-3 rounded-md font-medium flex items-center justify-center">
                <Heart size={18} className="mr-2" />
                THÊM VÀO YÊU THÍCH
              </button>
            </div>

            {/* Features */}
            {product.tags?.length > 0 && (
              <div className="mb-6">
                <h3 className="font-medium mb-3">Thẻ sản phẩm</h3>
                <div className="flex flex-wrap gap-2">
                  {product.tags.map((tag: string) => (
                    <span key={tag} className="text-xs border border-gray-300 rounded-md px-2 py-1 text-gray-600">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="container mx-auto px-4 py-8 border-t">
        <div className="border-b mb-6">
          <div className="flex flex-wrap -mb-px">
            {(['details', 'reviews'] as const).map(tab => (
              <button
                key={tab}
                className={`mr-8 pb-4 font-medium ${
                  activeTab === tab
                    ? 'border-b-2 border-gray-800 text-gray-800'
                    : 'text-gray-500 hover:text-gray-800'
                }`}
                onClick={() => setActiveTab(tab)}
              >
                {tab === 'details' ? 'Thông tin chi tiết' : `Đánh giá (${reviews.length})`}
              </button>
            ))}
          </div>
        </div>

        {activeTab === 'details' && (
          <div className="prose max-w-none">
            <p className="text-gray-700 mb-4">{product.description}</p>
            {product.weight && (
              <p className="text-sm text-gray-600"><span className="font-medium">Trọng lượng:</span> {product.weight}g</p>
            )}
            {product.dimensions && (
              <p className="text-sm text-gray-600">
                <span className="font-medium">Kích thước:</span>{' '}
                {product.dimensions.length} × {product.dimensions.width} × {product.dimensions.height} {product.dimensions.unit}
              </p>
            )}
          </div>
        )}

        {activeTab === 'reviews' && (
          <div>
            {reviews.length === 0 ? (
              <p className="text-gray-500">Chưa có đánh giá nào. Hãy là người đầu tiên đánh giá!</p>
            ) : (
              <div className="space-y-6">
                {reviews.map(review => (
                  <div key={review._id} className="border-b pb-6">
                    <div className="flex items-center mb-2">
                      <div className="flex mr-2">
                        {[...Array(review.rating)].map((_, i) => (
                          <Star key={i} size={14} fill="#f59e0b" color="#f59e0b" />
                        ))}
                        {[...Array(5 - review.rating)].map((_, i) => (
                          <Star key={i} size={14} fill="none" color="#d1d5db" />
                        ))}
                      </div>
                      <span className="font-medium text-sm">{review.userId?.name}</span>
                      <span className="mx-2 text-gray-400">·</span>
                      <span className="text-gray-500 text-sm">
                        {new Date(review.createdAt).toLocaleDateString('vi-VN')}
                      </span>
                    </div>
                    <p className="text-gray-700">{review.comment}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Related products */}
      {relatedProducts.length > 0 && (
        <div className="bg-[#f8f5f2] py-12">
          <div className="container mx-auto px-4">
            <h2 className="text-2xl font-serif font-bold mb-6">Bạn cũng có thể thích</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {relatedProducts.filter((p: any) => p._id !== productId).slice(0, 4).map((p: any) => {
                const img = p.images?.find((i: any) => i.isDefault)?.url || p.images?.[0]?.url;
                const imgUrl = urlUtils.getFullImageUrl(img) || fallback;
                return (
                  <div
                    key={p._id}
                    className="bg-white p-4 rounded-lg cursor-pointer"
                    onClick={() => navigate(`/shop/product/${p._id}`)}
                  >
                    <div className="relative mb-4 bg-[#f8f6f3] rounded-lg">
                      <img
                        src={imgUrl}
                        alt={p.name}
                        className="w-full h-48 object-contain"
                        onError={e => { (e.target as HTMLImageElement).src = fallback; }}
                      />
                      <button
                        className="absolute top-2 right-2 text-gray-500 hover:text-red-500"
                        onClick={e => e.stopPropagation()}
                      >
                        <Heart size={20} />
                      </button>
                    </div>
                    <h3 className="font-medium mb-1">{p.name}</h3>
                    <p className="text-gray-500 text-sm mb-2 line-clamp-2">{p.description}</p>
                    <span className="font-medium">{(p.basePrice || 0).toLocaleString()}₫</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const AlwaysPanProductPage: React.FC = () => (
  <ProductDetailErrorBoundary>
    <AlwaysPanProductPageInner />
  </ProductDetailErrorBoundary>
);

export default AlwaysPanProductPage;
