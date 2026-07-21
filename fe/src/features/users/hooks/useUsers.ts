// src/hooks/useUsers.ts

import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import userService from '../services/user-service';
import type {
  User,
  UserListRequest,
  UserFilters,
  UpdateUserRequest
} from '../interfaces/interface';

export const useUsers = (initialFilters: Partial<UserListRequest> = {}) => {
  const queryClient = useQueryClient();
  
  const [filters, setFilters] = useState<UserFilters>({
    search: '',
    role: '',
    authProvider: '',
    isEmailVerified: '',
    isDeleted: '',
    ...initialFilters
  });
  
  const [pagination, setPagination] = useState({
    currentPage: 1,
    limit: 10
  });
  
  const [sorting, setSorting] = useState({
    field: 'createdAt' as keyof User,
    direction: 'desc' as 'asc' | 'desc'
  });
  
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);

  // Build query params
  const queryParams: UserListRequest = {
    page: pagination.currentPage,
    limit: pagination.limit,
    search: filters.search || undefined,
    role: filters.role || undefined,
    authProvider: filters.authProvider || undefined,
    isEmailVerified: filters.isEmailVerified !== '' ? filters.isEmailVerified : undefined,
    isDeleted: filters.isDeleted !== '' ? filters.isDeleted : undefined,
    sortBy: sorting.field,
    sortOrder: sorting.direction
  };

  // Fetch users query
  const {
    data: usersData,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['users', queryParams],
    queryFn: () => userService.getUsers(queryParams),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Update user mutation
  const updateUserMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateUserRequest }) =>
      userService.updateUser(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('Cập nhật người dùng thành công');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Cập nhật người dùng thất bại');
    }
  });

  // Change role mutation
  const changeRoleMutation = useMutation({
    mutationFn: ({ id, role }: { id: string; role: User['role'] }) =>
      userService.changeUserRole(id, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('Thay đổi quyền thành công');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Thay đổi quyền thất bại');
    }
  });

  // Delete user mutation
  const deleteUserMutation = useMutation({
    mutationFn: (id: string) => userService.deleteUser(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('Xóa người dùng thành công');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Xóa người dùng thất bại');
    }
  });

  // Restore user mutation
  const restoreUserMutation = useMutation({
    mutationFn: (id: string) => userService.restoreUser(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('Khôi phục người dùng thành công');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Khôi phục người dùng thất bại');
    }
  });

  // Bulk delete mutation
  const bulkDeleteMutation = useMutation({
    mutationFn: (userIds: string[]) => userService.bulkDeleteUsers(userIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setSelectedUsers([]);
      toast.success('Xóa người dùng thành công');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Xóa người dùng thất bại');
    }
  });

  // Export mutation
  const exportMutation = useMutation({
    mutationFn: ({ format }: { format: 'excel' | 'csv' }) =>
      userService.exportUsers(format, queryParams),
    onSuccess: (blob, variables) => {
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `users.${variables.format}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success('Xuất file thành công');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Xuất file thất bại');
    }
  });

  // Handlers
  const handleFilterChange = useCallback((newFilters: Partial<UserFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
    setPagination(prev => ({ ...prev, currentPage: 1 })); // Reset to first page
  }, []);

  const handlePageChange = useCallback((page: number) => {
    setPagination(prev => ({ ...prev, currentPage: page }));
  }, []);

  const handleLimitChange = useCallback((limit: number) => {
    setPagination({ currentPage: 1, limit });
  }, []);

  const handleSort = useCallback((field: keyof User) => {
    setSorting(prev => ({
      field,
      direction: prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  }, []);

  const handleSelectUser = useCallback((userId: string) => {
    setSelectedUsers(prev => 
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  }, []);

  const handleSelectAll = useCallback((checked: boolean) => {
    if (checked && usersData?.users) {
      setSelectedUsers(usersData.users.map((user: User) => user._id));
    } else {
      setSelectedUsers([]);
    }
  }, [usersData?.users]);

  const clearFilters = useCallback(() => {
    setFilters({
      search: '',
      role: '',
      authProvider: '',
      isEmailVerified: '',
      isDeleted: ''
    });
    setPagination({ currentPage: 1, limit: 10 });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedUsers([]);
  }, []);

  // Helper functions
  const getCustomersOnly = useCallback(() => {
    return usersData?.users.filter((user: User) => user.role === 'customer') || [];
  }, [usersData?.users]);

  const getUsersByRole = useCallback((role: User['role']) => {
    return usersData?.users.filter((user: User) => user.role === role) || [];
  }, [usersData?.users]);

  return {
    // Data
    users: usersData?.users || [],
    customers: getCustomersOnly(),
    pagination: {
      ...pagination,
      total: usersData?.pagination.totalItems || 0,
      totalPages: usersData?.pagination.totalPages || 0
    },
    stats: usersData?.stats,
    
    // State
    filters,
    sorting,
    selectedUsers,
    isLoading,
    error,
    
    // Actions
    handleFilterChange,
    handlePageChange,
    handleLimitChange,
    handleSort,
    handleSelectUser,
    handleSelectAll,
    clearFilters,
    clearSelection,
    refetch,
    
    // User-specific actions
    updateUser: updateUserMutation.mutate,
    changeUserRole: changeRoleMutation.mutate,
    deleteUser: deleteUserMutation.mutate,
    restoreUser: restoreUserMutation.mutate,
    bulkDelete: bulkDeleteMutation.mutate,
    exportUsers: exportMutation.mutate,
    
    // Helper functions
    getUsersByRole,
    
    // Mutation states
    isUpdating: updateUserMutation.isLoading,
    isChangingRole: changeRoleMutation.isLoading,
    isDeleting: deleteUserMutation.isLoading,
    isRestoring: restoreUserMutation.isLoading,
    isBulkDeleting: bulkDeleteMutation.isLoading,
    isExporting: exportMutation.isLoading
  };
};