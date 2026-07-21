// src/features/auth/components/Login/LoginForm.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { useAuth } from '../../hooks/auth-hook';
import type { LoginRequest } from '../../interfaces/auth-interfaces';
import AuthLayout from '../AuthLayout';

const LoginForm: React.FC = () => {
  const { state: authState, login, clearError } = useAuth();
  const navigate = useNavigate();
  
  const [formData, setFormData] = useState<LoginRequest>({
    email: '',
    password: '',
    rememberMe: false
  });
  
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [formErrors, setFormErrors] = useState<{
    email?: string;
    password?: string;
  }>({});
  
  // Clear errors when component unmounts
  useEffect(() => {
    return () => {
      clearError();
    };
  }, [clearError]);
  
  const validateForm = (): boolean => {
    const errors: { email?: string; password?: string } = {};
    let isValid = true;
    
    if (!formData.email) {
      errors.email = 'Email là bắt buộc';
      isValid = false;
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      errors.email = 'Email không hợp lệ';
      isValid = false;
    }
    
    if (!formData.password) {
      errors.password = 'Mật khẩu là bắt buộc';
      isValid = false;
    }
    
    setFormErrors(errors);
    return isValid;
  };
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    try {
      await login(formData);
      // On successful login, navigate to the requested page or home
      // Navigation is handled in the login function in AuthContext
    } catch (error) {
      // Error is handled in the context
      console.error('Login error:', error);
    }
  };
  
  const handleForgotPassword = () => {
    navigate('/auth/forgot-password');
  };
  
  return (
    <AuthLayout 
      title="Đăng nhập vào tài khoản"
      notification={authState.error ? { type: 'error', message: authState.error } : undefined}
    >
      <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
        <div className="space-y-4">
          <div>
            <label htmlFor="login-email" className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Mail size={18} className="text-gray-400" />
              </div>
              <input
                id="login-email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={formData.email}
                onChange={handleChange}
                className="pl-10 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="email@example.com"
              />
              {formErrors.email && (
                <div className="flex items-center mt-1 text-red-500 text-sm">
                  <AlertCircle size={14} className="mr-1" />
                  {formErrors.email}
                </div>
              )}
            </div>
          </div>
          
          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="login-password" className="block text-sm font-medium text-gray-700">
                Mật khẩu
              </label>
              <button
                type="button"
                onClick={handleForgotPassword}
                className="text-sm text-blue-600 hover:underline"
              >
                Quên mật khẩu?
              </button>
            </div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock size={18} className="text-gray-400" />
              </div>
              <input
                id="login-password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                value={formData.password}
                onChange={handleChange}
                className="pl-10 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="••••••••"
              />
              <button
                type="button"
                className="absolute inset-y-0 right-0 pr-3 flex items-center"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? (
                  <EyeOff size={18} className="text-gray-400" />
                ) : (
                  <Eye size={18} className="text-gray-400" />
                )}
              </button>
              {formErrors.password && (
                <div className="flex items-center mt-1 text-red-500 text-sm">
                  <AlertCircle size={14} className="mr-1" />
                  {formErrors.password}
                </div>
              )}
            </div>
          </div>
          
          <div className="flex items-center">
            <input
              id="remember-me"
              name="rememberMe"
              type="checkbox"
              checked={formData.rememberMe}
              onChange={handleChange}
              className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-700">
              Ghi nhớ đăng nhập
            </label>
          </div>
        </div>
        
        <div>
          <button
            type="submit"
            disabled={authState.loading}
            className="w-full bg-[#b75e41] text-white py-3 rounded-md font-medium hover:bg-[#a34e32] transition-colors disabled:opacity-50"
          >
            {authState.loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
          </button>
        </div>
        
        <div className="text-center mt-6">
          <p className="text-sm text-gray-600">
            Chưa có tài khoản?{' '}
            <button
              type="button"
              onClick={() => navigate('/auth/signup')}
              className="text-blue-600 hover:underline font-medium"
            >
              Đăng ký ngay
            </button>
          </p>
        </div>
      </form>
    </AuthLayout>
  );
};

export default LoginForm;
