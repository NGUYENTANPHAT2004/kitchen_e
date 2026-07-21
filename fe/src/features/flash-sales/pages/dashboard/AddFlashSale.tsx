import React, { useState } from 'react';
import {
  Zap, Save, Plus, Search,
  ArrowLeft, Trash2, Tag, Percent
} from 'lucide-react';
import { useProducts } from '../../../products/hooks/useProducts';
import { useCreateFlashSale, useAddFlashSaleItem } from '../../hooks/useFlashSales';
import type { Product } from '../../../products/interface/productCustomization';
import type { FlashSaleItem } from '../../interface/interface';

type ProductUI = {
  _id: string;
  id: string;
  name: string;
  image?: string;
  images?: Array<{ url: string }>;
  basePrice: number;
  sku: string;
  stock: number;
  category: string;
  variants?: Array<{ _id: string; name: string; price: number; stock: number }>;
}

type SaleItemUi = Pick<
    FlashSaleItem,
    | 'sale_itemId'
    | 'productName'
    | 'productImage'
    | 'variantId'
    | 'variantName'
    | 'originalPrice'
    | 'discountPercent'
    | 'discountedPrice'
    | 'quantity'
    | 'maxPerCustomer'>;

const AddFlashSale: React.FC = () => {
  const [name, setName] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [startTime, setStartTime] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [endTime, setEndTime] = useState<string>('');
  const [status, setStatus] = useState<'scheduled' | 'active'>('scheduled');
  const [bannerImage, setBannerImage] = useState<string>('');
  const [priority, setPriority] = useState<number>(0);
  const [saleItems, setSaleItems] = useState<SaleItemUi[]>([]);

  // Product selection state
  const [showProductSelector, setShowProductSelector] = useState<boolean>(false);
  const [selectedProduct, setSelectedProduct] = useState<ProductUI | null>(null);
  const [selectedVariantId, setSelectedVariantId] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [discountPercent, setDiscountPercent] = useState<number>(0);
  const [quantity, setQuantity] = useState<number>(0);
  const [maxPerCustomer, setMaxPerCustomer] = useState<number>(0);

  // Form validation state
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formChanged, setFormChanged] = useState<boolean>(false);

  // Real products from API
  const { data: productsData } = useProducts({ search: searchTerm || undefined, limit: 50 });
  const allProducts: ProductUI[] = (productsData?.data?.products ?? []).map((p: Product) => ({
    _id: p._id,
    id: p._id,
    name: p.name,
    image: p.images?.[0]?.url,
    basePrice: p.basePrice,
    sku: p.sku,
    stock: p.stockQuantity,
    category: typeof p.categoryId === 'object' ? p.categoryId?.name : '',
  }));
  const filteredProducts = allProducts;

  const createMutation = useCreateFlashSale();
  const addItemMutation = useAddFlashSaleItem();

  // Calculate discounted price
  const calculateDiscountedPrice = (originalPrice: number, discountPercent: number): number => {
    return originalPrice * (1 - discountPercent / 100);
  };

  // Add product to flash sale
  const handleAddProduct = () => {
    if (!selectedProduct) return;

    // Validate required fields
    const newErrors: Record<string, string> = {};

    if (discountPercent <= 0 || discountPercent > 100) {
      newErrors.discountPercent = 'Giảm giá phải lớn hơn 0 và nhỏ hơn hoặc bằng 100%';
    }

    if (quantity <= 0) {
      newErrors.quantity = 'Số lượng phải lớn hơn 0';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    // Get variant if selected
    const selectedVariant = selectedProduct.variants?.find(v => v._id === selectedVariantId);
    const originalPrice = selectedVariant ? selectedVariant.price : selectedProduct.basePrice;
    // Create new flash sale item
    const newItem: SaleItemUi = {
      sale_itemId: selectedProduct._id,
      productName: selectedProduct.name,
      productImage: selectedProduct.images?.[0]?.url,
      originalPrice,
      discountPercent,
      discountedPrice: calculateDiscountedPrice(originalPrice, discountPercent),
      quantity,
      maxPerCustomer,
      variantId: selectedVariant?._id,
      variantName: selectedVariant?.name,
    };

    // Add to sale items
    setSaleItems([...saleItems, newItem]);
    setFormChanged(true);

    // Reset selection state
    setSelectedProduct(null);
    setSelectedVariantId('');
    setDiscountPercent(0);
    setQuantity(0);
    setMaxPerCustomer(0);
    setErrors({});
    setShowProductSelector(false);
  };

  // Remove product from flash sale
  const handleRemoveProduct = (index: number) => {
    const newItems = [...saleItems];
    newItems.splice(index, 1);
    setSaleItems(newItems);
    setFormChanged(true);
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const newErrors: Record<string, string> = {};
    if (!name) newErrors.name = 'Tên chương trình không được để trống';
    if (!startDate) newErrors.startDate = 'Ngày bắt đầu không được để trống';
    if (!startTime) newErrors.startTime = 'Giờ bắt đầu không được để trống';
    if (!endDate) newErrors.endDate = 'Ngày kết thúc không được để trống';
    if (!endTime) newErrors.endTime = 'Giờ kết thúc không được để trống';
    if (saleItems.length === 0) newErrors.items = 'Cần có ít nhất một sản phẩm trong chương trình';

    const startDateTime = new Date(`${startDate}T${startTime}`);
    const endDateTime = new Date(`${endDate}T${endTime}`);
    if (endDateTime <= startDateTime) newErrors.endDate = 'Thời gian kết thúc phải sau thời gian bắt đầu';

    if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return; }

    try {
      const result = await createMutation.mutateAsync({
        name,
        description: description || undefined,
        startDate: startDateTime.toISOString(),
        endDate: endDateTime.toISOString(),
        bannerImage: bannerImage || undefined,
        priority,
      });

      const flashSaleId = result.flashSale._id;
      await Promise.all(
        saleItems.map(item =>
          addItemMutation.mutateAsync({
            flashSaleId,
            item: {
              productId: item.sale_itemId,
              variantId: item.variantId || undefined,
              discountPercent: item.discountPercent,
              quantity: item.quantity,
              maxPerCustomer: item.maxPerCustomer || undefined,
            },
          })
        )
      );

      setFormChanged(false);
      window.history.back();
    } catch (err: any) {
      alert(err?.response?.data?.message ?? 'Không thể tạo Flash Sale');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center">
            <button
              onClick={() => window.history.back()}
              className="mr-4 p-2 text-gray-500 hover:text-gray-700"
            >
              <ArrowLeft size={20} />
            </button>
            <h1 className="text-2xl font-bold text-gray-800 flex items-center">
              <Zap className="mr-2" size={24} />
              Tạo Flash Sale mới
            </h1>
          </div>
          <p className="mt-1 text-gray-500">
            Tạo chương trình giảm giá nhanh với thời gian giới hạn
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => window.history.back()}
            className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Hủy
          </button>
          <button
            onClick={handleSubmit}
            disabled={!formChanged}
            className={`px-4 py-2 rounded-md shadow-sm text-sm font-medium text-white ${formChanged
                ? 'bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500'
                : 'bg-gray-300 cursor-not-allowed'
              }`}
          >
            <Save className="w-4 h-4 inline mr-1" />
            Lưu Flash Sale
          </button>
        </div>
      </div>

      <div className="bg-white shadow-sm rounded-lg">
        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-6">
            <div>
              <h2 className="text-lg font-medium text-gray-900">Thông tin chung</h2>
              <p className="mt-1 text-sm text-gray-500">
                Nhập thông tin cơ bản cho chương trình Flash Sale
              </p>
            </div>

            <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
              <div className="sm:col-span-3">
                <label htmlFor="flash-sale-name" className="block text-sm font-medium text-gray-700">
                  Tên chương trình <span className="text-red-500">*</span>
                </label>
                <div className="mt-1">
                  <input
                    type="text"
                    id="flash-sale-name"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      setFormChanged(true);
                    }}
                    className={`shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md ${errors.name ? 'border-red-300' : ''
                      }`}
                    placeholder="VD: Flash Sale cuối tuần"
                  />
                  {errors.name && (
                    <p className="mt-2 text-sm text-red-600">{errors.name}</p>
                  )}
                </div>
              </div>

              <div className="sm:col-span-3">
                <label htmlFor="flash-sale-banner" className="block text-sm font-medium text-gray-700">
                  Banner URL
                </label>
                <div className="mt-1">
                  <input
                    type="text"
                    id="flash-sale-banner"
                    value={bannerImage}
                    onChange={(e) => {
                      setBannerImage(e.target.value);
                      setFormChanged(true);
                    }}
                    className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                    placeholder="Nhập URL hình ảnh banner"
                  />
                </div>
              </div>

              <div className="sm:col-span-6">
                <label htmlFor="flash-sale-description" className="block text-sm font-medium text-gray-700">
                  Mô tả
                </label>
                <div className="mt-1">
                  <textarea
                    id="flash-sale-description"
                    rows={3}
                    value={description}
                    onChange={(e) => {
                      setDescription(e.target.value);
                      setFormChanged(true);
                    }}
                    className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                    placeholder="Mô tả ngắn về chương trình Flash Sale"
                  />
                </div>
              </div>

              <div className="sm:col-span-3">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="start-date" className="block text-sm font-medium text-gray-700">
                      Ngày bắt đầu <span className="text-red-500">*</span>
                    </label>
                    <div className="mt-1">
                      <input
                        type="date"
                        id="start-date"
                        value={startDate}
                        onChange={(e) => {
                          setStartDate(e.target.value);
                          setFormChanged(true);
                        }}
                        className={`shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md ${errors.startDate ? 'border-red-300' : ''
                          }`}
                      />
                      {errors.startDate && (
                        <p className="mt-2 text-sm text-red-600">{errors.startDate}</p>
                      )}
                    </div>
                  </div>
                  <div>
                    <label htmlFor="start-time" className="block text-sm font-medium text-gray-700">
                      Giờ bắt đầu <span className="text-red-500">*</span>
                    </label>
                    <div className="mt-1">
                      <input
                        type="time"
                        id="start-time"
                        value={startTime}
                        onChange={(e) => {
                          setStartTime(e.target.value);
                          setFormChanged(true);
                        }}
                        className={`shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md ${errors.startTime ? 'border-red-300' : ''
                          }`}
                      />
                      {errors.startTime && (
                        <p className="mt-2 text-sm text-red-600">{errors.startTime}</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="sm:col-span-3">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="end-date" className="block text-sm font-medium text-gray-700">
                      Ngày kết thúc <span className="text-red-500">*</span>
                    </label>
                    <div className="mt-1">
                      <input
                        type="date"
                        id="end-date"
                        value={endDate}
                        onChange={(e) => {
                          setEndDate(e.target.value);
                          setFormChanged(true);
                        }}
                        className={`shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md ${errors.endDate ? 'border-red-300' : ''
                          }`}
                      />
                      {errors.endDate && (
                        <p className="mt-2 text-sm text-red-600">{errors.endDate}</p>
                      )}
                    </div>
                  </div>
                  <div>
                    <label htmlFor="end-time" className="block text-sm font-medium text-gray-700">
                      Giờ kết thúc <span className="text-red-500">*</span>
                    </label>
                    <div className="mt-1">
                      <input
                        type="time"
                        id="end-time"
                        value={endTime}
                        onChange={(e) => {
                          setEndTime(e.target.value);
                          setFormChanged(true);
                        }}
                        className={`shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md ${errors.endTime ? 'border-red-300' : ''
                          }`}
                      />
                      {errors.endTime && (
                        <p className="mt-2 text-sm text-red-600">{errors.endTime}</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="sm:col-span-3">
                <label htmlFor="flash-sale-status" className="block text-sm font-medium text-gray-700">
                  Trạng thái
                </label>
                <div className="mt-1">
                  <select
                    id="flash-sale-status"
                    value={status}
                    onChange={(e) => {
                      setStatus(e.target.value as 'scheduled' | 'active');
                      setFormChanged(true);
                    }}
                    className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                  >
                    <option value="draft">Bản nháp</option>
                    <option value="scheduled">Đã lên lịch</option>
                    <option value="active">Đang hoạt động</option>
                  </select>
                </div>
              </div>

              <div className="sm:col-span-3">
                <label htmlFor="flash-sale-priority" className="block text-sm font-medium text-gray-700">
                  Độ ưu tiên (0-100)
                </label>
                <div className="mt-1">
                  <input
                    type="number"
                    id="flash-sale-priority"
                    value={priority}
                    min={0}
                    max={100}
                    onChange={(e) => {
                      setPriority(Number(e.target.value));
                      setFormChanged(true);
                    }}
                    className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                  />
                  <p className="mt-1 text-sm text-gray-500">
                    Giá trị cao hơn = độ ưu tiên cao hơn
                  </p>
                </div>
              </div>
            </div>

            <div className="border-t border-gray-200 pt-6">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-lg font-medium text-gray-900">Sản phẩm Flash Sale</h2>
                  <p className="mt-1 text-sm text-gray-500">
                    Thêm sản phẩm vào chương trình Flash Sale
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowProductSelector(true)}
                  className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Thêm sản phẩm
                </button>
              </div>

              {errors.items && (
                <p className="mt-2 text-sm text-red-600">{errors.items}</p>
              )}

              {/* Product selection popup */}
              {showProductSelector && (
                <div className="fixed z-10 inset-0 overflow-y-auto">
                  <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                    <div className="fixed inset-0 transition-opacity" aria-hidden="true">
                      <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
                    </div>

                    <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

                    <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full">
                      <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                        <div className="sm:flex sm:items-start">
                          <div className="mt-3 text-center sm:mt-0 sm:text-left w-full">
                            <h3 className="text-lg leading-6 font-medium text-gray-900">
                              Thêm sản phẩm vào Flash Sale
                            </h3>

                            <div className="mt-4">
                              {/* Search and filter */}
                              <div className="relative flex w-full mb-4">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                  <Search className="h-5 w-5 text-gray-400" />
                                </div>
                                <input
                                  type="text"
                                  placeholder="Tìm kiếm sản phẩm theo tên, mã SKU, danh mục..."
                                  className="pl-10 w-full py-2 px-4 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                  value={searchTerm}
                                  onChange={(e) => setSearchTerm(e.target.value)}
                                />
                              </div>

                              {/* Product list */}
                              <div className="max-h-80 overflow-y-auto border border-gray-200 rounded-md mb-4">
                                <table className="min-w-full divide-y divide-gray-200">
                                  <thead className="bg-gray-50 sticky top-0">
                                    <tr>
                                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Sản phẩm
                                      </th>
                                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        SKU
                                      </th>
                                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Giá gốc
                                      </th>
                                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Tồn kho
                                      </th>
                                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Hành động
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody className="bg-white divide-y divide-gray-200">
                                    {filteredProducts.map((product) => (
                                      <tr
                                        key={product.id}
                                        className={`hover:bg-gray-50 cursor-pointer ${selectedProduct?.id === product.id ? 'bg-indigo-50' : ''
                                          }`}
                                        onClick={() => setSelectedProduct(product)}
                                      >
                                        <td className="px-6 py-4 whitespace-nowrap">
                                          <div className="flex items-center">
                                            <div className="h-10 w-10 flex-shrink-0">
                                              {product.image ? (
                                                <img
                                                  src={product.image}
                                                  alt={product.name}
                                                  className="h-10 w-10 rounded-full"
                                                />
                                              ) : (
                                                <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center">
                                                  <Tag className="h-5 w-5 text-gray-400" />
                                                </div>
                                              )}
                                            </div>
                                            <div className="ml-4">
                                              <div className="text-sm font-medium text-gray-900">{product.name}</div>
                                              <div className="text-sm text-gray-500">{product.category}</div>
                                            </div>
                                          </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                          <div className="text-sm text-gray-900">{product.sku}</div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                          <div className="text-sm text-gray-900">{product.basePrice.toLocaleString()} VNĐ</div>
                                          {product.variants && (
                                            <div className="text-xs text-gray-500">Có biến thể</div>
                                          )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                          <div className="text-sm text-gray-900">{product.stock}</div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setSelectedProduct(product);
                                            }}
                                            className="text-indigo-600 hover:text-indigo-900"
                                          >
                                            Chọn
                                          </button>
                                        </td>
                                      </tr>
                                    ))}

                                    {filteredProducts.length === 0 && (
                                      <tr>
                                        <td colSpan={5} className="px-6 py-4 text-center text-sm text-gray-500">
                                          Không tìm thấy sản phẩm phù hợp
                                        </td>
                                      </tr>
                                    )}
                                  </tbody>
                                </table>
                              </div>

                              {/* Selected product info and discount form */}
                              {selectedProduct && (
                                <div className="border border-gray-200 rounded-md p-4">
                                  <h4 className="text-md font-medium text-gray-900 mb-2">
                                    Thiết lập giảm giá cho: {selectedProduct.name}
                                  </h4>

                                  <div className="grid grid-cols-1 gap-y-4 gap-x-4 sm:grid-cols-6">
                                    {selectedProduct.variants && selectedProduct.variants.length > 0 && (
                                      <div className="sm:col-span-6">
                                        <label htmlFor="variant-select" className="block text-sm font-medium text-gray-700">
                                          Biến thể
                                        </label>
                                        <div className="mt-1">
                                          <select
                                            id="variant-select"
                                            value={selectedVariantId}
                                            onChange={(e) => setSelectedVariantId(e.target.value)}
                                            className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                                          >
                                            <option value="">Sản phẩm gốc (không chọn biến thể)</option>
                                            {selectedProduct.variants.map((variant) => (
                                              <option key={variant._id} value={variant._id}>
                                                {variant.name} - {variant.price.toLocaleString()} VNĐ - SL: {variant.stock}
                                              </option>
                                            ))}
                                          </select>
                                        </div>
                                      </div>
                                    )}

                                    <div className="sm:col-span-2">
                                      <label htmlFor="discount-percent" className="block text-sm font-medium text-gray-700">
                                        Phần trăm giảm giá (%) <span className="text-red-500">*</span>
                                      </label>
                                      <div className="mt-1 relative rounded-md shadow-sm">
                                        <input
                                          type="number"
                                          id="discount-percent"
                                          min={1}
                                          max={100}
                                          value={discountPercent}
                                          onChange={(e) => setDiscountPercent(Number(e.target.value))}
                                          className={`focus:ring-indigo-500 focus:border-indigo-500 block w-full pr-12 sm:text-sm border-gray-300 rounded-md ${errors.discountPercent ? 'border-red-300' : ''
                                            }`}
                                          placeholder="VD: 30"
                                        />
                                        <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                                          <Percent className="h-5 w-5 text-gray-400" aria-hidden="true" />
                                        </div>
                                      </div>
                                      {errors.discountPercent && (
                                        <p className="mt-2 text-sm text-red-600">{errors.discountPercent}</p>
                                      )}
                                    </div>

                                    <div className="sm:col-span-2">
                                      <label htmlFor="sale-quantity" className="block text-sm font-medium text-gray-700">
                                        Số lượng giảm giá <span className="text-red-500">*</span>
                                      </label>
                                      <div className="mt-1">
                                        <input
                                          type="number"
                                          id="sale-quantity"
                                          min={1}
                                          value={quantity}
                                          onChange={(e) => setQuantity(Number(e.target.value))}
                                          className={`shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md ${errors.quantity ? 'border-red-300' : ''
                                            }`}
                                          placeholder="VD: 50"
                                        />
                                        {errors.quantity && (
                                          <p className="mt-2 text-sm text-red-600">{errors.quantity}</p>
                                        )}
                                      </div>
                                    </div>

                                    <div className="sm:col-span-2">
                                      <label htmlFor="max-per-customer" className="block text-sm font-medium text-gray-700">
                                        Số lượng tối đa / khách hàng
                                      </label>
                                      <div className="mt-1">
                                        <input
                                          type="number"
                                          id="max-per-customer"
                                          min={0}
                                          value={maxPerCustomer}
                                          onChange={(e) => setMaxPerCustomer(Number(e.target.value))}
                                          className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                                          placeholder="0 = không giới hạn"
                                        />
                                      </div>
                                    </div>

                                    <div className="sm:col-span-6">
                                      <div className="flex justify-between bg-gray-50 p-3 rounded-md">
                                        <div>
                                          <span className="text-sm text-gray-500">Giá gốc:</span>
                                          <span className="ml-2 text-sm font-medium text-gray-900">
                                            {selectedVariantId
                                              ? selectedProduct.variants?.find(v => v._id === selectedVariantId)?.price.toLocaleString()
                                              : selectedProduct.basePrice.toLocaleString()}{' '}
                                            VNĐ
                                          </span>
                                        </div>
                                        <div>
                                          <span className="text-sm text-gray-500">Giá sau giảm:</span>
                                          <span className="ml-2 text-sm font-medium text-green-600">
                                            {calculateDiscountedPrice(
                                              selectedVariantId
                                                ? selectedProduct.variants?.find(v => v._id === selectedVariantId)?.price || 0
                                                : selectedProduct.basePrice,
                                              discountPercent
                                            ).toLocaleString()}{' '}
                                            VNĐ
                                          </span>
                                        </div>
                                        <div>
                                          <span className="text-sm text-gray-500">Tiết kiệm:</span>
                                          <span className="ml-2 text-sm font-medium text-red-600">
                                            {((selectedVariantId
                                              ? selectedProduct.variants?.find(v => v._id === selectedVariantId)?.price || 0
                                              : selectedProduct.basePrice) * discountPercent / 100).toLocaleString()}{' '}
                                            VNĐ
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                        <button
                          type="button"
                          onClick={handleAddProduct}
                          disabled={!selectedProduct}
                          className={`w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 text-base font-medium text-white sm:ml-3 sm:w-auto sm:text-sm ${selectedProduct
                              ? 'bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500'
                              : 'bg-gray-300 cursor-not-allowed'
                            }`}
                        >
                          Thêm vào Flash Sale
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowProductSelector(false)}
                          className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                        >
                          Hủy
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Product list */}
              {saleItems.length > 0 ? (
                <div className="mt-4 overflow-x-auto border border-gray-200 rounded-md">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Sản phẩm
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Giá gốc
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Giảm giá
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Giá Flash Sale
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Số lượng
                        </th>
                        <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Hành động
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {saleItems.map((item, index) => (
                        <tr key={`${item.sale_itemId}-${item.variantId || 'main'}`}>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="h-10 w-10 flex-shrink-0">
                                {item.productImage ? (
                                  <img
                                    src={item.productImage}
                                    alt={item.productName}
                                    className="h-10 w-10 rounded-full"
                                  />
                                ) : (
                                  <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center">
                                    <Tag className="h-5 w-5 text-gray-400" />
                                  </div>
                                )}
                              </div>
                              <div className="ml-4">
                                <div className="text-sm font-medium text-gray-900">{item.productName}</div>
                                {item.variantName && (
                                  <div className="text-xs text-gray-500">Biến thể: {item.variantName}</div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">{item.originalPrice.toLocaleString()} VNĐ</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-red-600">-{item.discountPercent}%</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-green-600">{item.discountedPrice.toLocaleString()} VNĐ</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">{item.quantity}</div>
                            {(item.maxPerCustomer ?? 0) > 0 && (
                              <div className="text-xs text-gray-500">
                                Tối đa {item.maxPerCustomer}/khách
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveProduct(index)}
                              className="text-red-600 hover:text-red-900"
                            >
                              <Trash2 className="h-5 w-5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="mt-4 border-2 border-dashed border-gray-300 rounded-md p-6 text-center">
                  <Tag className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900">Chưa có sản phẩm</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Bắt đầu thêm sản phẩm vào chương trình Flash Sale.
                  </p>
                  <div className="mt-6">
                    <button
                      type="button"
                      onClick={() => setShowProductSelector(true)}
                      className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                    >
                      <Plus className="-ml-1 mr-2 h-5 w-5" aria-hidden="true" />
                      Thêm sản phẩm
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Form Actions */}
          <div className="px-6 py-4 bg-gray-50 flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={() => window.history.back()}
              className="px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={!formChanged}
              className={`px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${formChanged
                  ? 'bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500'
                  : 'bg-gray-300 cursor-not-allowed'
                }`}
            >
              <Save className="w-4 h-4 inline mr-1" />
              Lưu Flash Sale
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddFlashSale;
