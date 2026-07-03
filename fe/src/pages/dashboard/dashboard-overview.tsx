import React from 'react';
import {
  ShoppingCart, Users, TrendingUp,
  TrendingDown, CreditCard, Package as PackageIcon, Receipt, Package
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useQuery } from '@tanstack/react-query';
import orderService from '../../features/order/services/order-service';
import { productService } from '../../features/products/services/productService';
import userService from '../../features/users/services/user-service';

// Stats cards component
interface StatCardProps {
  title: string;
  value: string;
  icon: React.ReactNode;
  change?: {
    value: string;
    isPositive: boolean;
  };
  bgColor: string;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, icon, change, bgColor }) => (
  <div className="bg-white rounded-lg shadow-sm p-6 flex flex-col">
    <div className="flex justify-between items-start">
      <div>
        <h3 className="text-gray-500 text-sm font-medium mb-1">{title}</h3>
        <h2 className="text-2xl font-bold text-gray-800 mb-2">{value}</h2>
      </div>
      <div className={`${bgColor} p-3 rounded-full`}>
        {icon}
      </div>
    </div>
    {change && (
      <div className="flex items-center mt-2">
        {change.isPositive ? (
          <TrendingUp size={18} className="text-green-500 mr-1" />
        ) : (
          <TrendingDown size={18} className="text-red-500 mr-1" />
        )}
        <span className={`text-sm ${change.isPositive ? 'text-green-500' : 'text-red-500'}`}>
          {change.value} so với tháng trước
        </span>
      </div>
    )}
  </div>
);

// Status badge component
interface StatusBadgeProps {
  status: string;
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  let colorClass = '';
  
  switch (status) {
    case 'Đang xử lý':
      colorClass = 'bg-blue-100 text-blue-800';
      break;
    case 'Đang giao hàng':
      colorClass = 'bg-yellow-100 text-yellow-800';
      break;
    case 'Hoàn thành':
      colorClass = 'bg-green-100 text-green-800';
      break;
    case 'Đã giao hàng':
      colorClass = 'bg-green-100 text-green-800';
      break;
    case 'Đã hủy':
      colorClass = 'bg-red-100 text-red-800';
      break;
    default:
      colorClass = 'bg-gray-100 text-gray-800';
  }
  
  return <span className={`px-2 py-1 rounded-full text-xs font-medium ${colorClass}`}>{status}</span>;
};

// Main Dashboard component
const Dashboard: React.FC = () => {
  const { data: ordersData, isLoading: loadingOrders } = useQuery(
    ['dashboard-orders'],
    () => orderService.getOrders({ page: 1, limit: 5, sort: '-createdAt' }),
    { staleTime: 60_000 }
  );

  const { data: productsData, isLoading: loadingProducts } = useQuery(
    ['dashboard-best-selling'],
    () => productService.getProducts({ sort: '-popularity', limit: 4 }),
    { staleTime: 60_000 }
  );

  const { data: orderStats } = useQuery(
    ['dashboard-order-stats'],
    () => orderService.getOrderStats(),
    { staleTime: 60_000 }
  );

  const { data: userStats } = useQuery(
    ['dashboard-user-stats'],
    () => userService.getUserStats(),
    { staleTime: 60_000 }
  );

  const recentOrders = ordersData?.orders ?? [];
  const bestSellingProducts = productsData?.data?.products ?? [];

  const formatVND = (n: number) =>
    new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', minimumFractionDigits: 0 }).format(n);

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });

  const STATUS_MAP: Record<string, string> = {
    pending: 'Đang xử lý',
    processing: 'Đang xử lý',
    shipping: 'Đang giao hàng',
    delivered: 'Đã giao hàng',
    completed: 'Hoàn thành',
    cancelled: 'Đã hủy',
  };

  // Biểu đồ doanh thu: gộp daily stats thật thành 7 mốc gần nhất
  const revenueData = (orderStats?.daily ?? [])
    .slice(-7)
    .map((d) => {
      const [, m, day] = d._id.split('-');
      return { name: `${day}/${m}`, revenue: d.totalSales };
    });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-800">Bảng điều khiển</h1>
        <div>
          <button className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors">
            Tạo báo cáo
          </button>
        </div>
      </div>
      
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Tổng doanh thu"
          value={formatVND(orderStats?.overall.totalSales ?? 0)}
          icon={<Receipt size={24} className="text-indigo-600" />}
          bgColor="bg-indigo-100"
        />
        <StatCard
          title="Tổng đơn hàng"
          value={(orderStats?.overall.totalOrders ?? 0).toLocaleString('vi-VN')}
          icon={<ShoppingCart size={24} className="text-blue-600" />}
          bgColor="bg-blue-100"
        />
        <StatCard
          title="Khách hàng mới (30 ngày)"
          value={(userStats?.newUsersThisMonth ?? 0).toLocaleString('vi-VN')}
          icon={<Users size={24} className="text-green-600" />}
          bgColor="bg-green-100"
        />
        <StatCard
          title="Giá trị đơn TB"
          value={formatVND(orderStats?.overall.averageOrderValue ?? 0)}
          icon={<CreditCard size={24} className="text-purple-600" />}
          bgColor="bg-purple-100"
        />
      </div>

      {/* Revenue Chart */}
      <div className="bg-white p-6 rounded-lg shadow-sm">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-lg font-semibold text-gray-800">Doanh thu theo ngày</h2>
        </div>
        <div className="h-80">
          {revenueData.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-500">
              Chưa có dữ liệu doanh thu
            </div>
          ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={revenueData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" axisLine={false} tickLine={false} />
              <YAxis
                axisLine={false}
                tickLine={false}
                tickFormatter={(value) => `${value / 1000000}M`}
              />
              <Tooltip
                formatter={(value: number) => [`${value.toLocaleString()} VNĐ`, 'Doanh thu']}
                labelFormatter={(label) => `Ngày ${label}`}
              />
              <Bar dataKey="revenue" fill="#6366F1" radius={[4, 4, 0, 0]} barSize={40} />
            </BarChart>
          </ResponsiveContainer>
          )}
        </div>
      </div>
      
      {/* Two Column Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Orders */}
        <div className="bg-white p-6 rounded-lg shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-semibold text-gray-800">Đơn hàng gần đây</h2>
            <a href="/orders" className="text-indigo-600 hover:text-indigo-800 text-sm font-medium">
              Xem tất cả
            </a>
          </div>
          <div className="overflow-x-auto">
            {loadingOrders ? (
              <div className="text-center text-gray-500 py-4">Đang tải...</div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <th className="px-3 py-3 border-b">Mã đơn</th>
                    <th className="px-3 py-3 border-b">Khách hàng</th>
                    <th className="px-3 py-3 border-b">Ngày</th>
                    <th className="px-3 py-3 border-b">Tổng tiền</th>
                    <th className="px-3 py-3 border-b">Trạng thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {recentOrders.map((order: any) => (
                    <tr key={order._id} className="hover:bg-gray-50">
                      <td className="px-3 py-4 whitespace-nowrap">
                        <span className="font-medium text-indigo-600">{order.orderNumber ?? order._id?.slice(-8)}</span>
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap">
                        {typeof order.userId === 'object' ? order.userId?.name : 'Khách hàng'}
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap">{formatDate(order.createdAt)}</td>
                      <td className="px-3 py-4 whitespace-nowrap">{formatVND(order.totalAmount ?? order.total ?? 0)}</td>
                      <td className="px-3 py-4 whitespace-nowrap">
                        <StatusBadge status={STATUS_MAP[order.status] ?? order.status} />
                      </td>
                    </tr>
                  ))}
                  {recentOrders.length === 0 && (
                    <tr><td colSpan={5} className="px-3 py-6 text-center text-gray-500">Chưa có đơn hàng</td></tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Best Selling Products */}
        <div className="bg-white p-6 rounded-lg shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-semibold text-gray-800">Sản phẩm nổi bật</h2>
            <a href="/products" className="text-indigo-600 hover:text-indigo-800 text-sm font-medium">
              Xem tất cả
            </a>
          </div>
          <div className="space-y-4">
            {loadingProducts ? (
              <div className="text-center text-gray-500 py-4">Đang tải...</div>
            ) : bestSellingProducts.length === 0 ? (
              <div className="text-center text-gray-500 py-4">Chưa có sản phẩm</div>
            ) : (
              bestSellingProducts.map((product: any, index: number) => (
                <div key={product._id ?? index} className="flex items-center p-3 hover:bg-gray-50 rounded-lg transition-colors">
                  <div className="w-10 h-10 bg-gray-200 rounded-md flex items-center justify-center overflow-hidden flex-shrink-0">
                    {product.images?.[0]?.url ? (
                      <img src={product.images[0].url} alt={product.name} className="w-full h-full object-cover" />
                    ) : (
                      <PackageIcon size={20} className="text-gray-400" />
                    )}
                  </div>
                  <div className="ml-4 flex-1">
                    <h3 className="text-sm font-medium text-gray-800">{product.name}</h3>
                    <p className="text-xs text-gray-500">{formatVND(product.basePrice)}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-semibold text-gray-800">{product.stockQuantity ?? '—'} tồn kho</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
      
      {/* Quick Actions */}
      <div className="bg-white p-6 rounded-lg shadow-sm">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Truy cập nhanh</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <a href="/products/add" className="flex flex-col items-center justify-center p-4 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors">
            <Package size={24} className="text-indigo-600 mb-2" />
            <span className="text-sm font-medium text-gray-700">Thêm sản phẩm</span>
          </a>
          <a href="/orders/processing" className="flex flex-col items-center justify-center p-4 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors">
            <ShoppingCart size={24} className="text-blue-600 mb-2" />
            <span className="text-sm font-medium text-gray-700">Xử lý đơn hàng</span>
          </a>
          <a href="/marketing/vouchers/add" className="flex flex-col items-center justify-center p-4 bg-green-50 hover:bg-green-100 rounded-lg transition-colors">
            <CreditCard size={24} className="text-green-600 mb-2" />
            <span className="text-sm font-medium text-gray-700">Tạo mã giảm giá</span>
          </a>
          <a href="/reports/sales" className="flex flex-col items-center justify-center p-4 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors">
            <TrendingUp size={24} className="text-purple-600 mb-2" />
            <span className="text-sm font-medium text-gray-700">Báo cáo doanh thu</span>
          </a>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
