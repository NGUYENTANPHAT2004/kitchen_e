import React, { useState } from 'react';
import { 
  Users, Search, Filter, Calendar, ChevronDown, Download, Printer,
  ChevronLeft, ChevronRight, BarChart2, TrendingUp, TrendingDown, 
  UserPlus, DollarSign, Mail, ArrowRight
} from 'lucide-react';
import { 
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';

// Mock data
const customerGrowthData = [
  { month: 'T1', new: 45, total: 345 },
  { month: 'T2', new: 52, total: 397 },
  { month: 'T3', new: 61, total: 458 },
  { month: 'T4', new: 48, total: 506 },
  { month: 'T5', new: 55, total: 561 },
  { month: 'T6', new: 67, total: 628 },
  { month: 'T7', new: 72, total: 700 },
  { month: 'T8', new: 58, total: 758 },
  { month: 'T9', new: 63, total: 821 },
  { month: 'T10', new: 75, total: 896 },
  { month: 'T11', new: 82, total: 978 },
  { month: 'T12', new: 68, total: 1046 },
];

const customerSourceData = [
  { name: 'Tìm kiếm Google', value: 35, color: '#4F46E5' },
  { name: 'Facebook', value: 25, color: '#3B82F6' },
  { name: 'Giới thiệu', value: 20, color: '#10B981' },
  { name: 'Email Marketing', value: 10, color: '#F59E0B' },
  { name: 'Trực tiếp', value: 10, color: '#EC4899' },
];

const customerPurchaseData = [
  { name: '1 lần', value: 35, color: '#4F46E5' },
  { name: '2-3 lần', value: 30, color: '#3B82F6' },
  { name: '4-6 lần', value: 20, color: '#06B6D4' },
  { name: '7-10 lần', value: 10, color: '#8B5CF6' },
  { name: '10+ lần', value: 5, color: '#EC4899' },
];

const topCustomersData = [
  { id: 1, name: 'Nguyễn Văn A', email: 'nguyenvana@example.com', phone: '0912345678', orders: 15, spent: 15600000, lastOrder: '15/05/2025' },
  { id: 2, name: 'Trần Thị B', email: 'tranthib@example.com', phone: '0923456789', orders: 12, spent: 12300000, lastOrder: '12/05/2025' },
  { id: 3, name: 'Lê Văn C', email: 'levanc@example.com', phone: '0934567890', orders: 10, spent: 9800000, lastOrder: '10/05/2025' },
  { id: 4, name: 'Phạm Thị D', email: 'phamthid@example.com', phone: '0945678901', orders: 9, spent: 8500000, lastOrder: '08/05/2025' },
  { id: 5, name: 'Hoàng Văn E', email: 'hoangvane@example.com', phone: '0956789012', orders: 8, spent: 7900000, lastOrder: '05/05/2025' },
  { id: 6, name: 'Đỗ Thị F', email: 'dothif@example.com', phone: '0967890123', orders: 7, spent: 6800000, lastOrder: '01/05/2025' },
  { id: 7, name: 'Vũ Văn G', email: 'vuvang@example.com', phone: '0978901234', orders: 6, spent: 5400000, lastOrder: '29/04/2025' },
  { id: 8, name: 'Đinh Thị H', email: 'dinhthih@example.com', phone: '0989012345', orders: 5, spent: 4800000, lastOrder: '25/04/2025' },
  { id: 9, name: 'Bùi Văn I', email: 'buivani@example.com', phone: '0990123456', orders: 4, spent: 3900000, lastOrder: '20/04/2025' },
  { id: 10, name: 'Lý Thị K', email: 'lythik@example.com', phone: '0901234567', orders: 4, spent: 3500000, lastOrder: '18/04/2025' },
];

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value);
};

const CustomerReport: React.FC = () => {
  const [dateRange, setDateRange] = useState<'7days' | '30days' | '90days' | '12months' | 'custom'>('12months');
  const [customDateRange, setCustomDateRange] = useState({ start: '', end: '' });
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [sortField, setSortField] = useState<'orders' | 'spent'>('spent');
  const [viewSection, setViewSection] = useState<'overview' | 'customers'>('overview');

  // Filtering top customers
  const filteredCustomers = topCustomersData.filter(customer => {
    return customer.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
           customer.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
           customer.phone.includes(searchTerm);
  });

  // Sorting
  const sortedCustomers = [...filteredCustomers].sort((a, b) => {
    if (sortField === 'orders') {
      return b.orders - a.orders;
    } else {
      return b.spent - a.spent;
    }
  });

  // Pagination
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentCustomers = sortedCustomers.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(sortedCustomers.length / itemsPerPage);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center">
          <Users className="mr-2" size={24} />
          Báo cáo khách hàng
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
          
          {/* View switcher */}
          <div className="flex items-center space-x-2 ml-auto">
            <button
              onClick={() => setViewSection('overview')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium ${
                viewSection === 'overview'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Tổng quan
            </button>
            <button
              onClick={() => setViewSection('customers')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium ${
                viewSection === 'customers'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Khách hàng cao cấp
            </button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm text-gray-500 font-medium">Tổng khách hàng</p>
              <h3 className="text-2xl font-bold text-gray-800 mt-1">1,046</h3>
            </div>
            <div className="bg-indigo-100 p-3 rounded-full">
              <Users className="h-6 w-6 text-indigo-600" />
            </div>
          </div>
          <div className="flex items-center mt-4">
            <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
            <span className="text-sm text-green-500">7.0% so với kỳ trước</span>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm text-gray-500 font-medium">Khách hàng mới</p>
              <h3 className="text-2xl font-bold text-gray-800 mt-1">68</h3>
            </div>
            <div className="bg-blue-100 p-3 rounded-full">
              <UserPlus className="h-6 w-6 text-blue-600" />
            </div>
          </div>
          <div className="flex items-center mt-4">
            <TrendingDown className="h-4 w-4 text-red-500 mr-1" />
            <span className="text-sm text-red-500">17.1% so với kỳ trước</span>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm text-gray-500 font-medium">Giá trị trung bình</p>
              <h3 className="text-2xl font-bold text-gray-800 mt-1">{formatCurrency(850000)}</h3>
            </div>
            <div className="bg-green-100 p-3 rounded-full">
              <DollarSign className="h-6 w-6 text-green-600" />
            </div>
          </div>
          <div className="flex items-center mt-4">
            <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
            <span className="text-sm text-green-500">3.2% so với kỳ trước</span>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm text-gray-500 font-medium">Tỷ lệ quay lại</p>
              <h3 className="text-2xl font-bold text-gray-800 mt-1">32.5%</h3>
            </div>
            <div className="bg-purple-100 p-3 rounded-full">
              <ArrowRight className="h-6 w-6 text-purple-600" />
            </div>
          </div>
          <div className="flex items-center mt-4">
            <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
            <span className="text-sm text-green-500">1.8% so với kỳ trước</span>
          </div>
        </div>
      </div>

      {viewSection === 'overview' ? (
        <>
          {/* Customer Growth Chart */}
          <div className="bg-white p-6 rounded-lg shadow-sm">
            <h2 className="text-lg font-semibold text-gray-800 mb-6">Tăng trưởng khách hàng theo thời gian</h2>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={customerGrowthData}
                  margin={{
                    top: 10,
                    right: 30,
                    left: 0,
                    bottom: 0,
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip formatter={(value, name) => {
                    if (name === 'new') return [`${value} khách hàng`, 'Khách hàng mới'];
                    if (name === 'total') return [`${value} khách hàng`, 'Tổng khách hàng'];
                    return [value, name];
                  }} />
                  <Legend />
                  <defs>
                    <linearGradient id="colorNew" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8884d8" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#8884d8" stopOpacity={0.1}/>
                    </linearGradient>
                    <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#4F46E5" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#4F46E5" stopOpacity={0.1}/>
                    </linearGradient>
                  </defs>
                  <Area type="monotone" dataKey="new" name="Khách hàng mới" stroke="#8884d8" fillOpacity={1} fill="url(#colorNew)" />
                  <Area type="monotone" dataKey="total" name="Tổng khách hàng" stroke="#4F46E5" fillOpacity={1} fill="url(#colorTotal)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Customer Insights Charts */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <h2 className="text-lg font-semibold text-gray-800 mb-6">Nguồn khách hàng</h2>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={customerSourceData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                      nameKey="name"
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    >
                      {customerSourceData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => [`${value}%`, 'Tỷ lệ']} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm">
              <h2 className="text-lg font-semibold text-gray-800 mb-6">Phân tích tần suất mua hàng</h2>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={customerPurchaseData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                      nameKey="name"
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    >
                      {customerPurchaseData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => [`${value}%`, 'Tỷ lệ']} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </>
      ) : (
        <>
          {/* Top Customers Section */}
          <div className="bg-white p-6 rounded-lg shadow-sm space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold text-gray-800">Khách hàng có giá trị cao</h2>
              
              <div className="flex items-center space-x-3">
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    placeholder="Tìm khách hàng..."
                    className="pl-10 py-2 px-4 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                
                <div className="relative">
                  <select
                    className="appearance-none pl-3 pr-8 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    value={sortField}
                    onChange={(e) => setSortField(e.target.value as 'orders' | 'spent')}
                  >
                    <option value="spent">Sắp xếp theo chi tiêu</option>
                    <option value="orders">Sắp xếp theo số đơn</option>
                  </select>
                  <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                    <Filter className="h-4 w-4 text-gray-400" />
                  </div>
                </div>
              </div>
            </div>
            
            {/* Top Customers Table */}
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      ID
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Khách hàng
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Liên hệ
                    </th>
                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Đơn hàng
                    </th>
                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Tổng chi tiêu
                    </th>
                    <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Đơn hàng gần nhất
                    </th>
                    <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Hành động
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {currentCustomers.map((customer, index) => (
                    <tr key={customer.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">#{customer.id}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center">
                            <span className="text-indigo-600 font-medium">
                              {customer.name.split(' ').map(n => n[0]).join('').substr(0, 2).toUpperCase()}
                            </span>
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">{customer.name}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900 flex items-center">
                          <Mail className="h-4 w-4 mr-1 text-gray-400" />
                          {customer.email}
                        </div>
                        <div className="text-sm text-gray-500 mt-1">
                          {customer.phone}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        {customer.orders} đơn
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        {formatCurrency(customer.spent)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center text-sm">
                        {customer.lastOrder}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                        <button className="text-indigo-600 hover:text-indigo-900">
                          Chi tiết
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {/* Pagination */}
            {totalPages > 0 && (
              <div className="flex items-center justify-between mt-4">
                <div className="text-sm text-gray-700">
                  Hiển thị <span className="font-medium">{indexOfFirstItem + 1}</span> đến{' '}
                  <span className="font-medium">{Math.min(indexOfLastItem, sortedCustomers.length)}</span> của{' '}
                  <span className="font-medium">{sortedCustomers.length}</span> khách hàng
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="px-3 py-2 border rounded-md text-sm font-medium text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }
                    
                    return (
                      <button
                        key={pageNum}
                        onClick={() => handlePageChange(pageNum)}
                        className={`px-3 py-2 border rounded-md text-sm font-medium ${
                          currentPage === pageNum
                            ? 'bg-indigo-600 text-white'
                            : 'text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                  <button
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="px-3 py-2 border rounded-md text-sm font-medium text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
          
          {/* Actions Card */}
          <div className="bg-white p-6 rounded-lg shadow-sm">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Hành động khách hàng</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 cursor-pointer">
                <h3 className="font-medium text-indigo-600 mb-2">Gửi email marketing</h3>
                <p className="text-sm text-gray-500">Gửi chiến dịch email đến khách hàng có giá trị cao</p>
              </div>
              <div className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 cursor-pointer">
                <h3 className="font-medium text-indigo-600 mb-2">Tạo mã giảm giá đặc biệt</h3>
                <p className="text-sm text-gray-500">Tạo mã giảm giá dành riêng cho khách hàng VIP</p>
              </div>
              <div className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 cursor-pointer">
                <h3 className="font-medium text-indigo-600 mb-2">Phân tích hành vi</h3>
                <p className="text-sm text-gray-500">Phân tích chi tiết hành vi mua sắm của khách hàng</p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default CustomerReport;