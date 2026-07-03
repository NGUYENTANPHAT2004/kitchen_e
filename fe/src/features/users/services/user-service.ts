// src/services/user-service.ts

import { api } from '../../../config/api_cli.config';
import type {
  User,
  UserListRequest,
  UserListResponse,
  UpdateUserRequest,
  UserStats,
} from '../interfaces/interface';

class UserService {
  private baseUrl = '/users';

  /**
   * Get users list with pagination and filters
   */
  async getUsers(params: UserListRequest = {}): Promise<UserListResponse> {
    try {
      const searchParams = new URLSearchParams();
      
      // Add pagination
      if (params.page) searchParams.append('page', params.page.toString());
      if (params.limit) searchParams.append('limit', params.limit.toString());
      
      // Add filters
      if (params.search) searchParams.append('search', params.search);
      if (params.role) searchParams.append('role', params.role);
      if (params.authProvider) searchParams.append('authProvider', params.authProvider);
      if (params.isEmailVerified !== undefined) {
        searchParams.append('isEmailVerified', params.isEmailVerified.toString());
      }
      if (params.isDeleted !== undefined) {
        searchParams.append('isDeleted', params.isDeleted.toString());
      }
      
      // Add sorting
      if (params.sortBy) searchParams.append('sort', `${params.sortOrder === 'desc' ? '-' : ''}${params.sortBy}`);
      
      const response = await api.get(`${this.baseUrl}?${searchParams.toString()}`);

      // Process response data
      const data = response.data.data ?? response.data;
      const users = data.users || [];
      const pagination = data.pagination || {
        currentPage: 1,
        totalPages: 1,
        totalItems: 0,
        limit: 10
      };

      // Get stats if needed
      let stats;
      try {
        const statsResponse = await this.getUserStats();
        stats = statsResponse;
      } catch (error) {
        console.warn('Failed to fetch user stats:', error);
      }
      
      return {
        users: users.map(this.transformUser),
        pagination,
        stats
      };
    } catch (error) {
      console.error('Failed to fetch users:', error);
      throw error;
    }
  }

  /**
   * Transform user data to include calculated fields
   */
  private transformUser(user: any): User {
    return {
      ...user,
      fullName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username,
      customerCode: user.role === 'customer' ? `CUST-${user._id.slice(-6).toUpperCase()}` : undefined,
      status: user.isDeleted ? 'blocked' : 
               !user.isEmailVerified ? 'inactive' : 'active'
    };
  }

  /**
   * Get user by ID
   */
  async getUserById(id: string): Promise<{ user: User }> {
    try {
      const response = await api.get(`${this.baseUrl}/${id}`);
      const data = response.data.data ?? response.data;
      return { user: this.transformUser(data.user) };
    } catch (error) {
      console.error('Failed to fetch user:', error);
      throw error;
    }
  }

  /**
   * Update user
   */
  async updateUser(id: string, data: UpdateUserRequest): Promise<{ user: User }> {
    try {
      const response = await api.put(`${this.baseUrl}/${id}`, data);
      const d = response.data.data ?? response.data;
      return { user: this.transformUser(d.user) };
    } catch (error) {
      console.error('Failed to update user:', error);
      throw error;
    }
  }

  /**
   * Change user role
   */
  async changeUserRole(id: string, role: User['role']): Promise<{ user: User }> {
    try {
      const response = await api.put(`${this.baseUrl}/${id}`, { role });
      const d = response.data.data ?? response.data;
      return { user: this.transformUser(d.user) };
    } catch (error) {
      console.error('Failed to change user role:', error);
      throw error;
    }
  }

  /**
   * Delete user (soft delete)
   */
  async deleteUser(id: string): Promise<void> {
    try {
      await api.delete(`${this.baseUrl}/${id}`);
    } catch (error) {
      console.error('Failed to delete user:', error);
      throw error;
    }
  }

  /**
   * Restore deleted user
   */
  async restoreUser(id: string): Promise<{ user: User }> {
    try {
      const response = await api.put(`${this.baseUrl}/${id}/restore`);
      const d = response.data.data ?? response.data;
      return { user: this.transformUser(d.user) };
    } catch (error) {
      console.error('Failed to restore user:', error);
      throw error;
    }
  }

  /**
   * Get user statistics
   */
  async getUserStats(): Promise<UserStats> {
    try {
      const response = await api.get(`${this.baseUrl}/stats`);
      const d = response.data?.data ?? response.data ?? {};
      const roles = d.usersByRole ?? {};
      const providers = d.usersByProvider ?? {};
      return {
        totalUsers: d.totalUsers ?? 0,
        activeUsers: d.totalUsers ?? 0,
        newUsersThisMonth: d.newUsers ?? 0,
        usersByRole: {
          customer: roles.customer ?? 0,
          staff: roles.staff ?? 0,
          admin: roles.admin ?? 0,
        },
        usersByProvider: {
          local: providers.local ?? 0,
          google: providers.google ?? 0,
          facebook: providers.facebook ?? 0,
        },
      };
    } catch (error) {
      console.error('Failed to fetch user stats:', error);
      throw error;
    }
  }

  /**
   * Search users
   */
  async searchUsers(query: string, limit = 10): Promise<{ users: User[] }> {
    try {
      const response = await api.get(`${this.baseUrl}/search?query=${encodeURIComponent(query)}&limit=${limit}`);
      const d = response.data.data ?? response.data;
      return { users: (d.users ?? []).map(this.transformUser) };
    } catch (error) {
      console.error('Failed to search users:', error);
      throw error;
    }
  }

  /**
   * Export users data
   */
  async exportUsers(format: 'excel' | 'csv', filters?: UserListRequest): Promise<Blob> {
    try {
      const params = new URLSearchParams();
      params.append('format', format);
      
      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
          if (value !== undefined && value !== '') {
            params.append(key, value.toString());
          }
        });
      }

      const response = await api.get(`${this.baseUrl}/export?${params.toString()}`, {
        responseType: 'blob'
      });
      return response.data;
    } catch (error) {
      console.error('Failed to export users:', error);
      throw error;
    }
  }

  /**
   * Bulk operations placeholder (if backend supports)
   */
  async bulkUpdateUsers(userIds: string[], updates: Partial<UpdateUserRequest>): Promise<void> {
    try {
      // Since backend might not have bulk update, update individually
      await Promise.all(
        userIds.map(id => this.updateUser(id, updates))
      );
    } catch (error) {
      console.error('Failed to bulk update users:', error);
      throw error;
    }
  }

  /**
   * Bulk delete users
   */
  async bulkDeleteUsers(userIds: string[]): Promise<void> {
    try {
      // Delete individually since backend might not have bulk delete
      await Promise.all(
        userIds.map(id => this.deleteUser(id))
      );
    } catch (error) {
      console.error('Failed to bulk delete users:', error);
      throw error;
    }
  }

  /**
   * Get user orders summary (for customers)
   */
  async getUserOrdersSummary(id: string): Promise<any> {
    try {
      const response = await api.get(`${this.baseUrl}/${id}/orders-summary`);
      return response.data;
    } catch (error) {
      console.error('Failed to fetch user orders summary:', error);
      throw error;
    }
  }

  /**
   * Get user addresses
   */
  async getUserAddresses(id: string): Promise<any> {
    try {
      const response = await api.get(`${this.baseUrl}/${id}/addresses`);
      return response.data;
    } catch (error) {
      console.error('Failed to fetch user addresses:', error);
      throw error;
    }
  }
}

export default new UserService();