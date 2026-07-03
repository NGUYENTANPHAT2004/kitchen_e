import React, { useState } from 'react';
import { 
  BarChart2, Calendar, Filter, Download, Printer, ChevronDown,
  DollarSign, ShoppingCart, Users, Package, TrendingUp, TrendingDown,
  ArrowRight, Zap
} from 'lucide-react';
import { 
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';

// Demo data
const salesData = [
  { month: 'T1', revenue: 32000000, orders: 128, profit: 12800000 },
  { month: 'T2', revenue: 48000000, orders: 192, profit: 19200000 },
  { month: 'T3', revenue: 40000000, orders: 160, profit: 16000000 },
  { month: 'T4', revenue: 56000000, orders: 224, profit: 22400000 },
  { month: 'T5', revenue: 64000000, orders: 256, profit: 25600000 },
  { month: 'T6', revenue: 60000000, orders: 240, profit: 24000000 },
  { month: 'T7', revenue: 72000000, orders: 288, profit: 28800000 },
  { month: 'T8', revenue: 80000000, orders: 320, profit: 32000000 },
  { month: 'T9', revenue: 76000000, orders: 304, profit: 30400000 },
  { month: 'T10', revenue: 68000000, orders: 272, profit: 27200000 },
  { month: 'T11', revenue: 84000000, orders: 336, profit: 33600000 },
  { month: 'T12', revenue: 92000000, orders: 368, profit: 36800000 },
];

const productCategoryData = [
  { name: 'Dao/kéo', value: 30, color: '#4F46E5' },
  { name: 'Nồi/chảo', value: 25, color: '#3B82F6' },
  { name: 'Đồ điện tử', value: 20, color: '#06B6D4' },
  { name: 'Phụ kiện nhà bếp', value: 15, color: '#0EA5E9' },
  { name: 'Bếp/lò', value: 10, color: '#8B5CF6' },
];

const customerData = [
  { month: 'T1', new: 40, returning: 88 },
  { month: 'T2', new: 60, returning: 132 },
  { month: 'T3', new: 50, returning: 110 },
  { month: 'T4', new: 70, returning: 154 },
  { month: 'T5', new: 80, returning: 176 },
  { month: 'T6', new: 75, returning: 165 },
  { month: 'T7', new: 90, returning: 198 },
  { month: 'T8', new: 100, returning: 220 },
  { month: 'T9', new: 95, returning: 209 },
  { month: 'T10', new: 85, returning: 187 },
  { month: 'T11', new: 105, returning: 231 },
  { month: 'T12', new: 115, returning: 253 },
];

const topProductsData = [
  { id: 1, name: 'Dao nhà bếp đa năng', category: 'Dao/kéo', revenue: 18400000, quantity: 92, profit: 7360000 },
  { id: 2, name: 'Bộ nồi inox 5 món', category: 'Nồi/chảo', revenue: 15300000, quantity: 51, profit: 6120000 },
  { id: 3, name: 'Chảo chống dính cao cấp', category: 'Nồi/chảo', revenue: 12200000, quantity: 61, profit: 4880000 },
  { id: 4, name: 'Máy xay sinh tố công suất lớn', category: 'Đồ điện tử', revenue: 10600000, quantity: 53, profit: 4240000 },
  { id: 5, name: 'Bếp gas âm', category: 'Bếp/lò', revenue: 8700000, quantity: 29, profit: 3480000 },
];

const SalesReport: React.FC = () => {
  const [dateRange, setDateRange] = useState<'today' | '7days' | '30days' | '90days' | '12months' | 'custom'>('12months');
  const [customDateRange, setCustomDateRange] = useState({ start: '', end: '' });
  const [chartView, setChartView] = useState<'revenue' | 'orders' | 'profit'>('revenue');

  // Stats calculation (demo values)
  const totalRevenue = 772000000; // VNĐ
  const totalOrders = 3088;
  const totalProfit = 308800000; // VNĐ
  const averageOrderValue = Math.round(totalRevenue / totalOrders);
  const conversionRate = 4.2; // %
  
  const comparedToLastPeriod = {
    revenue: { value: 15.8, isPositive: true },
    orders: { value: 12.3, isPositive: true },
    profit: { value: 18.5, isPositive: true },
    averageOrderValue: { value: 3.2, isPositive: true },
    conversionRate: { value: 0.7, isPositive: true },
  };

  // Format values to Vietnamese currency
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  // For charts
  const formatTooltipCurrency = (value: number) => {
    return formatCurrency(value);
  };

  // Format chart values to shorter forms
  const formatYAxisCurrency = (value: number) => {
    if (value >= 1000000000) {
      return `${value / 1000000000}B`;
    }
    if (value >= 1000000) {
      return `${value / 1000000}M`;
    }
    if (value >= 1000) {
      return `${value / 1000}K`;
    }
    return value;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center">
          <BarChart2 className="mr-2" size={24} />
          Báo cáo doanh thu
        </h1>
        <div className="mt-4 sm:mt-0 flex flex-wrap gap-2">
          <button className="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
            <Download size={16} className="mr-1" />
            Xuất Excel
          </button>
          <button className="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
            <Printer size={16} className="mr-1" />
            In báo cáo
          </button>
        </div>
      </div>

      {/* Date Range Filter */}
      <div className="bg-white shadow-sm rounded-lg p-6 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setDateRange('today')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium ${
                dateRange === 'today'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Hôm nay
            </button>
            <button
              onClick={() => setDateRange('7days')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium ${
                dateRange === '7days'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              7 ngày qua
            </button>
            <button
              onClick={() => setDateRange('30days')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium ${
                dateRange === '30days'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              30 ngày qua
            </button>
            <button
              onClick={() => setDateRange('90days')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium ${
                dateRange === '90days'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              90 ngày qua
            </button>
            <button
              onClick={() => setDateRange('12months')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium ${
                dateRange === '12months'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              12 tháng qua
            </button>
            <button
              onClick={() => setDateRange('custom')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium ${
                dateRange === 'custom'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Tùy chỉnh
            </button>
          </div>
          
          {dateRange === 'custom' && (
            <div className="flex items-center gap-2">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Calendar className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="date"
                  className="pl-10 py-2 px-4 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  value={customDateRange.start}
                  onChange={(e) => setCustomDateRange({ ...customDateRange, start: e.target.value })}
                />
              </div>
              <span className="text-gray-500">đến</span>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Calendar className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="date"
                  className="pl-10 py-2 px-4 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  value={customDateRange.end}
                  onChange={(e) => setCustomDateRange({ ...customDateRange, end: e.target.value })}
                />
              </div>
              <button className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
                Áp dụng
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        {/* Total Revenue */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm text-gray-500 font-medium">Tổng doanh thu</p>
              <h3 className="text-2xl font-bold text-gray-800 mt-1">{formatCurrency(totalRevenue)}</h3>
            </div>
            <div className="bg-indigo-100 p-3 rounded-full">
              <DollarSign className="h-6 w-6 text-indigo-600" />
            </div>
          </div>
          <div className="flex items-center mt-4">
            {comparedToLastPeriod.revenue.isPositive ? (
              <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-500 mr-1" />
            )}
            <span className={`text-sm ${comparedToLastPeriod.revenue.isPositive ? 'text-green-500' : 'text-red-500'}`}>
              {comparedToLastPeriod.revenue.value}% so với kỳ trước
            </span>
          </div>
        </div>

        {/* Total Orders */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm text-gray-500 font-medium">Tổng đơn hàng</p>
              <h3 className="text-2xl font-bold text-gray-800 mt-1">{totalOrders.toLocaleString()}</h3>
            </div>
            <div className="bg-blue-100 p-3 rounded-full">
              <ShoppingCart className="h-6 w-6 text-blue-600" />
            </div>
          </div>
          <div className="flex items-center mt-4">
            {comparedToLastPeriod.orders.isPositive ? (
              <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-500 mr-1" />
            )}
            <span className={`text-sm ${comparedToLastPeriod.orders.isPositive ? 'text-green-500' : 'text-red-500'}`}>
              {comparedToLastPeriod.orders.value}% so với kỳ trước
            </span>
          </div>
        </div>

        {/* Total Profit */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm text-gray-500 font-medium">Tổng lợi nhuận</p>
              <h3 className="text-2xl font-bold text-gray-800 mt-1">{formatCurrency(totalProfit)}</h3>
            </div>
            <div className="bg-green-100 p-3 rounded-full">
              <TrendingUp className="h-6 w-6 text-green-600" />
            </div>
          </div>
          <div className="flex items-center mt-4">
            {comparedToLastPeriod.profit.isPositive ? (
              <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-500 mr-1" />
            )}
            <span className={`text-sm ${comparedToLastPeriod.profit.isPositive ? 'text-green-500' : 'text-red-500'}`}>
              {comparedToLastPeriod.profit.value}% so với kỳ trước
            </span>
          </div>
        </div>

        {/* Average Order Value */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm text-gray-500 font-medium">Giá trị đơn trung bình</p>
              <h3 className="text-2xl font-bold text-gray-800 mt-1">{formatCurrency(averageOrderValue)}</h3>
            </div>
            <div className="bg-purple-100 p-3 rounded-full">
              <Package className="h-6 w-6 text-purple-600" />
            </div>
          </div>
          <div className="flex items-center mt-4">
            {comparedToLastPeriod.averageOrderValue.isPositive ? (
              <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-500 mr-1" />
            )}
            <span className={`text-sm ${comparedToLastPeriod.averageOrderValue.isPositive ? 'text-green-500' : 'text-red-500'}`}>
              {comparedToLastPeriod.averageOrderValue.value}% so với kỳ trước
            </span>
          </div>
        </div>

        {/* Conversion Rate */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm text-gray-500 font-medium">Tỷ lệ chuyển đổi</p>
              <h3 className="text-2xl font-bold text-gray-800 mt-1">{conversionRate}%</h3>
            </div>
            <div className="bg-orange-100 p-3 rounded-full">
              <Zap className="h-6 w-6 text-orange-600" />
            </div>
          </div>
          <div className="flex items-center mt-4">
            {comparedToLastPeriod.conversionRate.isPositive ? (
              <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-500 mr-1" />
            )}
            <span className={`text-sm ${comparedToLastPeriod.conversionRate.isPositive ? 'text-green-500' : 'text-red-500'}`}>
              {comparedToLastPeriod.conversionRate.value}% so với kỳ trước
            </span>
          </div>
        </div>
      </div>

      {/* Main Chart */}
      <div className="bg-white p-6 rounded-lg shadow-sm">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-lg font-semibold text-gray-800">Biểu đồ doanh thu theo thời gian</h2>
          <div className="flex space-x-2">
            <button
              onClick={() => setChartView('revenue')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md ${
                chartView === 'revenue'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Doanh thu
            </button>
            <button
              onClick={() => setChartView('orders')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md ${
                chartView === 'orders'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Đơn hàng
            </button>
            <button
              onClick={() => setChartView('profit')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md ${
                chartView === 'profit'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Lợi nhuận
            </button>
          </div>
        </div>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            {chartView === 'revenue' ? (
              <AreaChart data={salesData}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4F46E5" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#4F46E5" stopOpacity={0.1}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" axisLine={false} tickLine={false} />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tickFormatter={formatYAxisCurrency}
                />
                <Tooltip 
                  formatter={(value: number) => [formatTooltipCurrency(value), 'Doanh thu']}
                  labelFormatter={(label) => `Tháng ${label}`}
                />
                <Area 
                  type="monotone" 
                  dataKey="revenue" 
                  stroke="#4F46E5" 
                  fillOpacity={1} 
                  fill="url(#colorRevenue)" 
                />
              </AreaChart>
            ) : chartView === 'orders' ? (
              <BarChart data={salesData} barSize={20}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" axisLine={false} tickLine={false} />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                />
                <Tooltip 
                  formatter={(value: number) => [`${value} đơn`, 'Số đơn hàng']}
                  labelFormatter={(label) => `Tháng ${label}`}
                />
                <Bar dataKey="orders" fill="#3B82F6" radius={[4, 4, 0, 0]} />
              </BarChart>
            ) : (
              <LineChart data={salesData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" axisLine={false} tickLine={false} />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tickFormatter={formatYAxisCurrency}
                />
                <Tooltip 
                  formatter={(value: number) => [formatTooltipCurrency(value), 'Lợi nhuận']}
                  labelFormatter={(label) => `Tháng ${label}`}
                />
                <Line 
                  type="monotone" 
                  dataKey="profit" 
                  stroke="#10B981" 
                  strokeWidth={3} 
                  dot={{ r: 4 }} 
                  activeDot={{ r: 6 }} 
                />
              </LineChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>

      {/* Secondary Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Product Categories Chart */}
        <div className="bg-white p-6 rounded-lg shadow-sm">
          <h2 className="text-lg font-semibold text-gray-800 mb-6">Doanh thu theo danh mục sản phẩm</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={productCategoryData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {productCategoryData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => [`${value}%`, 'Phần trăm doanh thu']} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Customer Stats Chart */}
        <div className="bg-white p-6 rounded-lg shadow-sm">
          <h2 className="text-lg font-semibold text-gray-800 mb-6">Khách hàng mới và khách hàng quay lại</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={customerData}
                barSize={20}
                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" axisLine={false} tickLine={false} />
                <YAxis axisLine={false} tickLine={false} />
                <Tooltip />
                <Legend />
                <Bar dataKey="new" name="Khách hàng mới" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="returning" name="Khách hàng quay lại" fill="#0EA5E9" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Top Products Table */}
      <div className="bg-white p-6 rounded-lg shadow-sm">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-lg font-semibold text-gray-800">Sản phẩm bán chạy nhất</h2>
          <button className="text-indigo-600 hover:text-indigo-800 text-sm font-medium flex items-center">
            Xem tất cả sản phẩm
            <ArrowRight className="ml-1 h-4 w-4" />
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Sản phẩm
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Danh mục
                </th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Doanh thu
                </th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Số lượng bán
                </th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Lợi nhuận
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {topProductsData.map((product) => (
                <tr key={product.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="h-10 w-10 flex-shrink-0">
                        <div className="h-10 w-10 rounded-md bg-gray-200 flex items-center justify-center">
                          <Package className="h-6 w-6 text-gray-400" />
                        </div>
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">{product.name}</div>
                        <div className="text-sm text-gray-500">#{product.id}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                      {product.category}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    {formatCurrency(product.revenue)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                    {product.quantity} sản phẩm
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    {formatCurrency(product.profit)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default SalesReport;
