export interface User {
  _id: string;
  username: string;
  name?: string;
  email: string;
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  avatar?: string;
  role: 'customer' | 'staff' | 'admin';
  authProvider: 'local' | 'google' | 'facebook';
  isEmailVerified: boolean;
  isDeleted: boolean;
  lastLogin?: Date | string;
  createdAt?: Date | string;
  updatedAt?: Date | string;

  // Calculated fields for display
  fullName?: string;
  customerCode?: string;
  totalOrders?: number;
  totalSpent?: number;
  status?: 'active' | 'inactive' | 'blocked';
}
