import React, { useState } from 'react';
import { Scissors, Clock, AlertCircle, Copy, Share2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../../../config/api_cli.config';
import type { TabType, Voucher } from '../../interface/interface';
async function fetchPublicVouchers(): Promise<Voucher[]> {
  const response = await api.get('/vouchers/public');
  return response.data.data ?? response.data ?? [];
}

const VouchersPage: React.FC = () => {
  const { data: vouchers = [], isLoading, isError } = useQuery({
    queryKey: ['vouchers', 'public'],
    queryFn: fetchPublicVouchers,
  });

  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [selectedVoucher, setSelectedVoucher] = useState<Voucher | null>(null);
  const [notification, setNotification] = useState<{ show: boolean; message: string }>({
    show: false,
    message: '',
  });

  const isExpired = (v: Voucher) => !v.isActive || new Date(v.endDate) < new Date();

  const filteredVouchers = vouchers.filter((v) => {
    if (activeTab === 'all') return true;
    if (activeTab === 'expired') return isExpired(v);
    return !isExpired(v);
  });

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code)
      .then(() => {
        setNotification({ show: true, message: 'Đã sao chép mã giảm giá!' });
        setTimeout(() => setNotification({ show: false, message: '' }), 3000);
      })
      .catch(() => {});
  };

  const handleShareVoucher = (voucher: Voucher) => {
    if (navigator.share) {
      navigator.share({
        title: `Mã giảm giá ${voucher.name}`,
        text: `Dùng mã ${voucher.code}${voucher.description ? ` để ${voucher.description}` : ''}`,
        url: window.location.href,
      }).catch(() => {});
    } else {
      handleCopyCode(voucher.code);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#b75e41]"></div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-center justify-center h-64 text-red-500">
        Không thể tải phiếu giảm giá. Vui lòng thử lại sau.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8f5f2]">
      {notification.show && (
        <div className="fixed top-4 right-4 bg-green-600 text-white px-4 py-2 rounded-md shadow-lg z-50">
          {notification.message}
        </div>
      )}

      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-serif font-bold mb-1">Phiếu giảm giá</h1>
          <p className="text-gray-600">Các mã giảm giá đang có hiệu lực</p>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow-sm mb-6">
          <div className="flex border-b overflow-x-auto">
            {([['all', 'Tất cả'], ['valid', 'Có thể sử dụng'], ['expired', 'Đã hết hạn']] as [TabType, string][]).map(
              ([key, label]) => (
                <button
                  key={key}
                  className={`px-6 py-3 whitespace-nowrap ${
                    activeTab === key
                      ? 'border-b-2 border-gray-800 text-gray-800 font-medium'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                  onClick={() => setActiveTab(key)}
                >
                  {label} (
                  {key === 'all'
                    ? vouchers.length
                    : key === 'expired'
                    ? vouchers.filter(isExpired).length
                    : vouchers.filter((v) => !isExpired(v)).length}
                  )
                </button>
              )
            )}
          </div>
        </div>

        {/* Danh sách voucher */}
        {filteredVouchers.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredVouchers.map((voucher) => {
              const expired = isExpired(voucher);
              return (
                <div
                  key={voucher._id}
                  className={`bg-white rounded-lg shadow-sm overflow-hidden border ${
                    expired ? 'border-red-200 opacity-75' : 'border-green-200'
                  }`}
                >
                  {/* Header */}
                  <div className="relative">
                    <div className="h-20 bg-gray-100 flex items-center justify-center p-4">
                      <div className="flex items-center">
                        <Scissors size={20} className="text-gray-500 mr-2" />
                        <h3 className="font-medium text-lg">{voucher.name}</h3>
                      </div>
                    </div>
                    <div className="flex justify-between items-center -mt-1">
                      <div className="w-2 h-4 bg-[#f8f5f2] rounded-r-full"></div>
                      <div className="flex-1 border-b border-dashed border-gray-300"></div>
                      <div className="w-2 h-4 bg-[#f8f5f2] rounded-l-full"></div>
                    </div>
                  </div>

                  {/* Body */}
                  <div className="p-4">
                    {voucher.description && (
                      <p className="text-sm text-gray-600 mb-2">{voucher.description}</p>
                    )}
                    {voucher.minOrderValue && voucher.minOrderValue > 0 && (
                      <p className="text-xs text-gray-500 mb-2">
                        Đơn từ {voucher.minOrderValue.toLocaleString()}₫
                      </p>
                    )}

                    <div className="flex items-center justify-between mb-3">
                      <span className={`font-bold text-lg ${expired ? 'text-gray-400' : 'text-green-600'}`}>
                        {voucher.discountType === 'percentage'
                          ? `${voucher.discountValue}%`
                          : `${voucher.discountValue.toLocaleString()}₫`}
                      </span>
                      {voucher.usageLimit && (
                        <span className="text-xs text-gray-500">
                          Còn {Math.max(0, voucher.usageLimit - (voucher.usageCount ?? 0))} lần
                        </span>
                      )}
                    </div>

                    {/* Code */}
                    <div className="bg-gray-100 rounded-md p-3 flex items-center justify-between mb-3">
                      <span className="font-mono font-medium">{voucher.code}</span>
                      <button
                        className="text-blue-600 disabled:opacity-40"
                        onClick={() => handleCopyCode(voucher.code)}
                        disabled={expired}
                      >
                        <Copy size={16} />
                      </button>
                    </div>

                    {/* Footer */}
                    <div className="flex justify-between items-center">
                      <div className="flex items-center text-sm text-gray-600">
                        <Clock size={16} className="mr-1 text-gray-400" />
                        {expired
                          ? 'Đã hết hạn'
                          : `HSD: ${new Date(voucher.endDate).toLocaleDateString('vi-VN')}`}
                      </div>
                      {!expired && (
                        <div className="flex space-x-2">
                          <button
                            className="text-gray-500 hover:text-gray-700"
                            onClick={() => handleShareVoucher(voucher)}
                          >
                            <Share2 size={16} />
                          </button>
                          <button
                            className="text-blue-600 hover:text-blue-700 text-sm"
                            onClick={() => setSelectedVoucher(voucher)}
                          >
                            Chi tiết
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm p-8 text-center">
            <AlertCircle size={48} className="text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-medium mb-2">Không có phiếu giảm giá nào</h3>
            <p className="text-gray-600 mb-6">
              {activeTab === 'valid'
                ? 'Không có phiếu giảm giá nào có thể sử dụng.'
                : activeTab === 'expired'
                ? 'Không có phiếu giảm giá nào đã hết hạn.'
                : 'Chưa có phiếu giảm giá nào.'}
            </p>
            <a
              href="/shop"
              className="bg-[#b75e41] text-white px-6 py-3 rounded-md hover:bg-[#a34e32] inline-block"
            >
              Mua sắm ngay
            </a>
          </div>
        )}
      </div>

      {/* Modal chi tiết */}
      {selectedVoucher && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-medium">Chi tiết phiếu giảm giá</h2>
                <button className="text-gray-500 hover:text-gray-700" onClick={() => setSelectedVoucher(null)}>
                  &times;
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-medium mb-1">{selectedVoucher.name}</h3>
                  {selectedVoucher.description && (
                    <p className="text-gray-600">{selectedVoucher.description}</p>
                  )}
                </div>
                <div className="bg-gray-100 rounded-md p-4 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Mã:</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-medium">{selectedVoucher.code}</span>
                      <button className="text-blue-600" onClick={() => handleCopyCode(selectedVoucher.code)}>
                        <Copy size={16} />
                      </button>
                    </div>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Giảm giá:</span>
                    <span className="font-medium">
                      {selectedVoucher.discountType === 'percentage'
                        ? `${selectedVoucher.discountValue}%`
                        : `${selectedVoucher.discountValue.toLocaleString()}₫`}
                    </span>
                  </div>
                  {selectedVoucher.minOrderValue !== undefined && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Đơn tối thiểu:</span>
                      <span>
                        {selectedVoucher.minOrderValue > 0
                          ? `${selectedVoucher.minOrderValue.toLocaleString()}₫`
                          : 'Không giới hạn'}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-gray-600">Hết hạn:</span>
                    <span>{new Date(selectedVoucher.endDate).toLocaleDateString('vi-VN')}</span>
                  </div>
                </div>
                <div className="flex gap-3 pt-2">
                  <a
                    href="/shop/checkout"
                    className="flex-1 bg-[#b75e41] text-white py-2 rounded-md hover:bg-[#a34e32] text-center"
                  >
                    Dùng ngay
                  </a>
                  <button
                    className="px-3 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
                    onClick={() => handleShareVoucher(selectedVoucher)}
                  >
                    <Share2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VouchersPage;
