// src/pages/users/UserList.tsx

import React, { useState } from 'react';
import { 
  Users, Download, ArrowUpDown, Eye, Edit, MoreHorizontal, 
  ChevronLeft, ChevronRight, Mail, Phone, Trash2, RotateCcw,
  Shield, UserCheck, Calendar, Globe
} from 'lucide-react';

import { 
  UserStatusBadge, 
  UserRoleBadge, 
  UserAvatar,
  UserFiltersComponent,
  RoleChangeModal 
} from '../components/dashboard';
import type { User } from '../interfaces/interface';
import { useUsers } from '../hooks/useUsers';

const UserList: React.FC = () => {
  const {
    users,
    pagination,
    stats,
    filters,
    sorting,
    selectedUsers,
    isLoading,
    handleFilterChange,
    handlePageChange,
    handleLimitChange,
    handleSort,
    handleSelectUser,
    handleSelectAll,
    clearFilters,
    clearSelection,
    changeUserRole,
    deleteUser,
    restoreUser,
    bulkDelete,
    exportUsers,
    isChangingRole,
    isDeleting,
    isRestoring,
    isBulkDeleting,
    isExporting
  } = useUsers();

  const [roleChangeModal, setRoleChangeModal] = useState<{
    isOpen: boolean;
    user: User | null;
  }>({
    isOpen: false,
    user: null
  });

  const handleExport = (format: 'excel' | 'csv') => {
    exportUsers({ format });
  };

  const handleBulkAction = (action: string) => {
    if (selectedUsers.length === 0) return;
    
    switch (action) {
      case 'delete':
        if (confirm(`Bạn có chắc muốn xóa ${selectedUsers.length} người dùng?`)) {
          bulkDelete(selectedUsers);
        }
        break;
      default:
        break;
    }
  };

  const handleRoleChange = (user: User) => {
    setRoleChangeModal({
      isOpen: true,
      user
    });
  };

  const handleRoleChangeConfirm = (userId: string, newRole: User['role']) => {
    changeUserRole({ id: userId, role: newRole });
  };

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString('vi-VN');
  };

  const formatDateTime = (date: Date | string) => {
    return new Date(date).toLocaleString('vi-VN');
  };

  if (isLoading && users.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center">
          <Users className="mr-2" size={24} />
          Quản lý người dùng
        </h1>
        <div className="mt-4 sm:mt-0 flex flex-wrap gap-2">
          <button 
            onClick={() => handleExport('excel')}
            disabled={isExporting}
            className="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
          >
            <Download size={16} className="mr-1" />
            {isExporting ? 'Đang xuất...' : 'Xuất Excel'}
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-lg shadow-sm border">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Users className="h-6 w-6 text-indigo-600" />
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-500">Tổng người dùng</p>
                <p className="text-lg font-semibold text-gray-900">{stats.totalUsers.toLocaleString()}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white p-4 rounded-lg shadow-sm border">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <UserCheck className="h-6 w-6 text-green-600" />
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-500">Người dùng hoạt động</p>
                <p className="text-lg font-semibold text-gray-900">{stats.activeUsers.toLocaleString()}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white p-4 rounded-lg shadow-sm border">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Calendar className="h-6 w-6 text-blue-600" />
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-500">Người dùng mới tháng này</p>
                <p className="text-lg font-semibold text-gray-900">{stats.newUsersThisMonth.toLocaleString()}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white p-4 rounded-lg shadow-sm border">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Shield className="h-6 w-6 text-purple-600" />
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-500">Quản trị viên</p>
                <p className="text-lg font-semibold text-gray-900">{stats.usersByRole?.admin || 0}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <UserFiltersComponent
        filters={filters}
        onFilterChange={handleFilterChange}
        onClearFilters={clearFilters}
        isLoading={isLoading}
      />

      {/* Selected Items Actions */}
      {selectedUsers.length > 0 && (
        <div className="bg-indigo-50 p-4 rounded-md flex items-center justify-between">
          <span className="text-indigo-700 font-medium">
            {selectedUsers.length} người dùng được chọn
          </span>
          <div className="flex gap-2">
            <button 
              onClick={() => handleBulkAction('delete')}
              disabled={isBulkDeleting}
              className="inline-flex items-center px-3 py-1 bg-white text-red-600 border border-red-200 rounded-md hover:bg-red-50 disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Xóa
            </button>
            <button
              onClick={clearSelection}
              className="px-3 py-1 bg-white text-gray-600 border border-gray-200 rounded-md hover:bg-gray-50"
            >
              Bỏ chọn
            </button>
          </div>
        </div>
      )}

      {/* Users Table */}
      <div className="overflow-x-auto bg-white shadow-sm rounded-lg">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-3 py-3 text-left">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    checked={selectedUsers.length > 0 && selectedUsers.length === users.length}
                  />
                </div>
              </th>
              
              <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                <div 
                  className="flex items-center cursor-pointer hover:text-gray-700"
                  onClick={() => handleSort('username')}
                >
                  Người dùng
                  {sorting.field === 'username' && (
                    <ArrowUpDown 
                      className={`ml-1 h-4 w-4 ${
                        sorting.direction === 'asc' ? 'text-indigo-600' : 'text-indigo-600 transform rotate-180'
                      }`} 
                    />
                  )}
                </div>
              </th>
              
              <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Liên hệ
              </th>
              
              <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                <div 
                  className="flex items-center cursor-pointer hover:text-gray-700"
                  onClick={() => handleSort('role')}
                >
                  Quyền
                  {sorting.field === 'role' && (
                    <ArrowUpDown 
                      className={`ml-1 h-4 w-4 ${
                        sorting.direction === 'asc' ? 'text-indigo-600' : 'text-indigo-600 transform rotate-180'
                      }`} 
                    />
                  )}
                </div>
              </th>
              
              <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Nhà cung cấp
              </th>
              
              <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                <div 
                  className="flex items-center cursor-pointer hover:text-gray-700"
                  onClick={() => handleSort('createdAt')}
                >
                  Ngày đăng ký
                  {sorting.field === 'createdAt' && (
                    <ArrowUpDown 
                      className={`ml-1 h-4 w-4 ${
                        sorting.direction === 'asc' ? 'text-indigo-600' : 'text-indigo-600 transform rotate-180'
                      }`} 
                    />
                  )}
                </div>
              </th>
              
              <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Đăng nhập cuối
              </th>
              
              <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Trạng thái
              </th>
              
              <th scope="col" className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                Hành động
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {users.map((user) => (
              <tr key={user._id} className="hover:bg-gray-50">
                <td className="px-3 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                      checked={selectedUsers.includes(user._id)}
                      onChange={() => handleSelectUser(user._id)}
                    />
                  </div>
                </td>
                
                <td className="px-3 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="h-10 w-10 flex-shrink-0">
                      <UserAvatar name={user.fullName || user.username} src={user.avatar} />
                    </div>
                    <div className="ml-4">
                      <div className="text-sm font-medium text-gray-900">
                        {user.fullName || user.username}
                      </div>
                      <div className="text-sm text-gray-500">@{user.username}</div>
                      {user.customerCode && (
                        <div className="text-xs text-gray-400">{user.customerCode}</div>
                      )}
                    </div>
                  </div>
                </td>
                
                <td className="px-3 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900 flex items-center">
                    <Mail className="h-4 w-4 mr-1 text-gray-400" />
                    {user.email}
                    {user.isEmailVerified && (
                      <span className="ml-1 text-green-500" title="Email đã xác thực">✓</span>
                    )}
                  </div>
                  {user.phoneNumber && (
                    <div className="text-sm text-gray-500 flex items-center mt-1">
                      <Phone className="h-4 w-4 mr-1 text-gray-400" />
                      {user.phoneNumber}
                    </div>
                  )}
                </td>
                
                <td className="px-3 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <UserRoleBadge role={user.role} />
                    <button
                      onClick={() => handleRoleChange(user)}
                      className="text-gray-400 hover:text-indigo-600 transition-colors"
                      title="Thay đổi quyền"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                  </div>
                </td>
                
                <td className="px-3 py-4 whitespace-nowrap">
                  <div className="flex items-center text-sm text-gray-900">
                    <Globe className="h-4 w-4 mr-1 text-gray-400" />
                    {user.authProvider === 'local' ? 'Đăng ký thường' : 
                     user.authProvider === 'google' ? 'Google' : 'Facebook'}
                  </div>
                </td>
                
                <td className="px-3 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">{formatDate(user.createdAt ?? new Date())}</div>
                </td>
                
                <td className="px-3 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">
                    {user.lastLogin ? formatDateTime(user.lastLogin) : 'Chưa đăng nhập'}
                  </div>
                </td>
                
                <td className="px-3 py-4 whitespace-nowrap">
                  <UserStatusBadge status={user.status || 'active'} />
                  {user.isDeleted && (
                    <div className="text-xs text-red-500 mt-1">Đã xóa</div>
                  )}
                </td>
                
                <td className="px-3 py-4 whitespace-nowrap text-center text-sm font-medium">
                  <div className="flex justify-center gap-2">
                    <button 
                      className="text-indigo-600 hover:text-indigo-900 transition-colors" 
                      title="Xem chi tiết"
                    >
                      <Eye className="h-5 w-5" />
                    </button>
                    
                    {user.isDeleted ? (
                      <button 
                        onClick={() => restoreUser(user._id)}
                        disabled={isRestoring}
                        className="text-green-600 hover:text-green-900 transition-colors disabled:opacity-50" 
                        title="Khôi phục"
                      >
                        <RotateCcw className="h-5 w-5" />
                      </button>
                    ) : (
                      <button 
                        onClick={() => {
                          if (confirm('Bạn có chắc muốn xóa người dùng này?')) {
                            deleteUser(user._id);
                          }
                        }}
                        disabled={isDeleting}
                        className="text-red-600 hover:text-red-900 transition-colors disabled:opacity-50" 
                        title="Xóa"
                      >
                        <Trash2 className="h-5 w-5" />
                      </button>
                    )}
                    
                    <button 
                      className="text-gray-600 hover:text-gray-900 transition-colors" 
                      title="Thêm"
                    >
                      <MoreHorizontal className="h-5 w-5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination.totalPages > 0 && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="text-sm text-gray-700">
              Hiển thị <span className="font-medium">{((pagination.currentPage - 1) * pagination.limit) + 1}</span> đến{' '}
              <span className="font-medium">
                {Math.min(pagination.currentPage * pagination.limit, pagination.total)}
              </span>{' '}
              của <span className="font-medium">{pagination.total.toLocaleString()}</span> người dùng
            </div>
            
            <select
              className="appearance-none pl-3 pr-8 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
              value={pagination.limit}
              onChange={(e) => handleLimitChange(Number(e.target.value))}
            >
              <option value={10}>10 mục</option>
              <option value={25}>25 mục</option>
              <option value={50}>50 mục</option>
              <option value={100}>100 mục</option>
            </select>
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={() => handlePageChange(pagination.currentPage - 1)}
              disabled={pagination.currentPage === 1}
              className="px-3 py-2 border rounded-md text-sm font-medium text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            
            {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
              let pageNum;
              if (pagination.totalPages <= 5) {
                pageNum = i + 1;
              } else if (pagination.currentPage <= 3) {
                pageNum = i + 1;
              } else if (pagination.currentPage >= pagination.totalPages - 2) {
                pageNum = pagination.totalPages - 4 + i;
              } else {
                pageNum = pagination.currentPage - 2 + i;
              }
              
              return (
                <button
                  key={pageNum}
                  onClick={() => handlePageChange(pageNum)}
                  className={`px-3 py-2 border rounded-md text-sm font-medium transition-colors ${
                    pagination.currentPage === pageNum
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}
            
            <button
              onClick={() => handlePageChange(pagination.currentPage + 1)}
              disabled={pagination.currentPage === pagination.totalPages}
              className="px-3 py-2 border rounded-md text-sm font-medium text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Role Change Modal */}
      <RoleChangeModal
        isOpen={roleChangeModal.isOpen}
        onClose={() => setRoleChangeModal({ isOpen: false, user: null })}
        user={roleChangeModal.user}
        onConfirm={handleRoleChangeConfirm}
        isLoading={isChangingRole}
      />
      
      {/* Loading overlay */}
      {isLoading && (
        <div className="fixed inset-0 bg-black bg-opacity-20 flex items-center justify-center z-50">
          <div className="bg-white p-4 rounded-lg shadow-lg flex items-center">
            <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-indigo-500 mr-3"></div>
            <span>Đang tải...</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserList;