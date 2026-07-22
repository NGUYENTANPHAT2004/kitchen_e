import { createContext } from 'react';
import type {
  AuthState,
  LoginRequest,
  RegisterRequest,
  UpdateUserRequest,
  UpdatePasswordRequest,
} from '../interfaces/auth-interfaces';

interface AuthContextProps {
  state: AuthState;
  login: (data: LoginRequest) => Promise<void>;
  register: (data: RegisterRequest) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (data: UpdateUserRequest) => Promise<void>;
  updatePassword: (data: UpdatePasswordRequest) => Promise<void>;
  forgotPassword: (email: string) => Promise<{ success: boolean; message: string }>;
  resetPassword: (token: string, password: string) => Promise<{ success: boolean; message: string }>;
  verifyEmail: (token: string) => Promise<{ success: boolean; message: string }>;
  resendVerification: () => Promise<{ success: boolean; message: string }>;
  clearError: () => void;
  refreshUser: () => Promise<void>;
  loadUser: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextProps | undefined>(undefined);
