import React, { useState } from 'react';
import { Check, ChevronDown, Star } from 'lucide-react';
import { useMyOrders } from '../../../hooks/useMyOrders';
import type { Order } from '../../../interface/interface';

const STATUS_LABELS: Record<Order['status'], string> = {
  pending: 'Chờ xử lý',
  processing: 'Đang xử lý',
  shipped: 'Đang giao hàng',
  delivered: 'Đã giao hàng',
  cancelled: 'Đã hủy',
};

const STATUS_COLORS: Record<Order['status'], string> = {
  pending: 'bg-blue-100 text-blue-800',
  processing: 'bg-yellow-100 text-yellow-800',
  shipped: 'bg-purple-100 text-purple-800',
  delivered: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
};

type Tab = 'all' | Order['status'];

const OrdersPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('all');
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);

  const { orders, isLoading, isError, cancelOrder, isCancelling } = useMyOrders();

  const filteredOrders = activeTab === 'all'
    ? orders
    : orders.filter((o) => o.status === activeTab);

  const tabs: { key: Tab; label: string }[] = [
    { key: 'all', label: 'Tất cả' },
    { key: 'pending', label: 'Chờ xử lý' },
    { key: 'processing', label: 'Đang xử lý' },
    { key: 'shipped', label: 'Đang giao' },
    { key: 'delivered', label: 'Đã giao' },
    { key: 'cancelled', label: 'Đã hủy' },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#b75e41]" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-center justify-center h-64 text-red-500">
        Không thể tải đơn hàng. Vui lòng thử lại.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8f5f2]">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-serif font-bold mb-6">Đơn hàng của tôi</h1>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow-sm mb-6">
          <div className="flex border-b overflow-x-auto">
            {tabs.map(({ key, label }) => (
              <button
                key={key}
                className={`px-5 py-3 whitespace-nowrap text-sm ${
                  activeTab === key
                    ? 'border-b-2 border-gray-800 text-gray-800 font-medium'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
                onClick={() => setActiveTab(key)}
              >
                {label}
                {key !== 'all' && (
                  <span className="ml-1 text-xs text-gray-400">
                    ({orders.filter((o) => o.status === key).length})
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Order list */}
        {filteredOrders.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-8 text-center text-gray-500">
            Không có đơn hàng nào.
          </div>
        ) : (
          <div className="space-y-4">
            {filteredOrders.map((order) => (
              <div key={order._id} className="bg-white rounded-lg shadow-sm overflow-hidden">
                {/* Order header */}
                <div className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <span className="font-medium text-indigo-600">{order.orderNumber}</span>
                    <span className="mx-2 text-gray-400">·</span>
                    <span className="text-sm text-gray-500">
                      {new Date(order.createdAt).toLocaleDateString('vi-VN')}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_COLORS[order.status]}`}>
                      {STATUS_LABELS[order.status]}
                    </span>
                    <span className="font-semibold">{order.totalAmount.toLocaleString()}₫</span>
                    <button
                      onClick={() => setExpandedOrder(expandedOrder === order._id ? null : order._id)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <ChevronDown
                        size={18}
                        className={`transition-transform ${expandedOrder === order._id ? 'rotate-180' : ''}`}
                      />
                    </button>
                  </div>
                </div>

                {/* Order items preview */}
                <div className="px-4 pb-4 flex items-center gap-2 text-sm text-gray-600">
                  <span>{order.items.length} sản phẩm</span>
                  <span>·</span>
                  <span>{order.paymentMethod}</span>
                </div>

                {/* Expanded detail */}
                {expandedOrder === order._id && (
                  <div className="border-t px-4 pb-4">
                    <div className="mt-3 space-y-3">
                      {order.items.map((item) => {
                        const productName =
                          typeof item.productId === 'object'
                            ? item.productId.name
                            : item.productId;
                        const variantLabel =
                          item.variantId && typeof item.variantId === 'object'
                            ? item.variantId.attributes?.map((a) => `${a.name}: ${a.value}`).join(', ')
                            : null;
                        return (
                          <div key={item._id} className="flex justify-between text-sm">
                            <div>
                              <span className="font-medium">{productName}</span>
                              {variantLabel && (
                                <span className="text-gray-500 ml-1">({variantLabel})</span>
                              )}
                              <span className="text-gray-400 ml-1">x{item.quantity}</span>
                            </div>
                            <span>{(item.price * item.quantity).toLocaleString()}₫</span>
                          </div>
                        );
                      })}
                    </div>

                    {order.shippingAddress && (
                      <div className="mt-3 text-sm text-gray-600 border-t pt-3">
                        <span className="font-medium">Giao đến: </span>
                        {order.shippingAddress.fullName} · {order.shippingAddress.address},{' '}
                        {order.shippingAddress.city}, {order.shippingAddress.state} ·{' '}
                        {order.shippingAddress.phone}
                      </div>
                    )}

                    {/* Actions */}
                    <div className="mt-3 flex gap-2 justify-end">
                      {order.status === 'delivered' && (
                        <button className="flex items-center gap-1 px-3 py-1.5 text-sm border rounded-md hover:bg-gray-50">
                          <Star size={14} />
                          Đánh giá
                        </button>
                      )}
                      {(order.status === 'pending' || order.status === 'processing') && (
                        <button
                          onClick={() => {
                            if (confirm('Bạn có chắc muốn hủy đơn hàng này?')) {
                              cancelOrder(order._id);
                            }
                          }}
                          disabled={isCancelling}
                          className="flex items-center gap-1 px-3 py-1.5 text-sm text-red-600 border border-red-200 rounded-md hover:bg-red-50 disabled:opacity-50"
                        >
                          Hủy đơn
                        </button>
                      )}
                      {order.status === 'delivered' && (
                        <button className="flex items-center gap-1 px-3 py-1.5 text-sm bg-[#b75e41] text-white rounded-md hover:bg-[#a34e32]">
                          <Check size={14} />
                          Mua lại
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default OrdersPage;
