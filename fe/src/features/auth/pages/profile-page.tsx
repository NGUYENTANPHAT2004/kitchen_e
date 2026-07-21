// src/features/auth/pages/ProfilePage.tsx
import React, { useState, useEffect } from 'react';
import { CheckCircle, AlertCircle, Mail, User, AtSign, Phone, Lock, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../hooks/auth-hook';
import type { UpdateUserRequest, UpdatePasswordRequest } from '../interfaces/auth-interfaces';

const ProfilePage: React.FC = () => {
  const { state: authState, updateUser, updatePassword, resendVerification } = useAuth();
  const { user } = authState;
  
  // Form data for user profile
  const [profileForm, setProfileForm] = useState<UpdateUserRequest>({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    phoneNumber: user?.phoneNumber || ''
  });
  
  // Form data for password update
  const [passwordForm, setPasswordForm] = useState<UpdatePasswordRequest>({
    currentPassword: '',
    newPassword: ''
  });
  
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // State for showing/hiding passwords
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  // State for form submissions
  const [profileSubmitting, setProfileSubmitting] = useState(false);
  const [passwordSubmitting, setPasswordSubmitting] = useState(false);
  
  // State for notifications
  const [profileNotification, setProfileNotification] = useState<{
    type: 'success' | 'error' | null;
    message: string;
  }>({
    type: null,
    message: ''
  });
  
  const [passwordNotification, setPasswordNotification] = useState<{
    type: 'success' | 'error' | null;
    message: string;
  }>({
    type: null,
    message: ''
  });
  
  const [verificationNotification, setVerificationNotification] = useState<{
    type: 'success' | 'error' | null;
    message: string;
  }>({
    type: null,
    message: ''
  });
  
  // State for form errors
  const [profileErrors, setProfileErrors] = useState<{
    firstName?: string;
    lastName?: string;
    phoneNumber?: string;
  }>({});
  
  const [passwordErrors, setPasswordErrors] = useState<{
    currentPassword?: string;
    newPassword?: string;
    confirmPassword?: string;
  }>({});
  
  // Update form data when user data changes
  useEffect(() => {
    if (user) {
      setProfileForm({
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        phoneNumber: user.phoneNumber || ''
      });
    }
  }, [user]);
  
  // Handle profile form change
  const handleProfileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setProfileForm(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  // Handle password form change
  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    
    if (name === 'confirmPassword') {
      setConfirmPassword(value);
    } else {
      setPasswordForm(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };
  
  // Validate profile form
  const validateProfileForm = (): boolean => {
    const errors: {
      firstName?: string;
      lastName?: string;
      phoneNumber?: string;
    } = {};
    const isValid = true;
    
    // Add validation if needed
    
    setProfileErrors(errors);
    return isValid;
  };
  
  // Validate password form
  const validatePasswordForm = (): boolean => {
    const errors: {
      currentPassword?: string;
      newPassword?: string;
      confirmPassword?: string;
    } = {};
    let isValid = true;
    
    if (!passwordForm.currentPassword) {
      errors.currentPassword = 'Mật khẩu hiện tại là bắt buộc';
      isValid = false;
    }
    
    if (!passwordForm.newPassword) {
      errors.newPassword = 'Mật khẩu mới là bắt buộc';
      isValid = false;
    } else if (passwordForm.newPassword.length < 8) {
      errors.newPassword = 'Mật khẩu phải có ít nhất 8 ký tự';
      isValid = false;
    } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(passwordForm.newPassword)) {
      errors.newPassword = 'Mật khẩu phải chứa ít nhất một chữ hoa, một chữ thường và một số';
      isValid = false;
    }
    
    if (passwordForm.newPassword !== confirmPassword) {
      errors.confirmPassword = 'Mật khẩu xác nhận không khớp';
      isValid = false;
    }
    
    setPasswordErrors(errors);
    return isValid;
  };
  
  // Handle profile form submit
  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateProfileForm()) {
      return;
    }
    
    setProfileSubmitting(true);
    
    try {
      await updateUser(profileForm);
      
      setProfileNotification({
        type: 'success',
        message: 'Cập nhật thông tin thành công'
      });
      
      // Clear notification after 3 seconds
      setTimeout(() => {
        setProfileNotification({
          type: null,
          message: ''
        });
      }, 3000);
    } catch (error: any) {
      console.error('Profile update error:', error);
      
      setProfileNotification({
        type: 'error',
        message: error.message || 'Đã xảy ra lỗi khi cập nhật thông tin'
      });
    } finally {
      setProfileSubmitting(false);
    }
  };
  
  // Handle password form submit
  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validatePasswordForm()) {
      return;
    }
    
    setPasswordSubmitting(true);
    
    try {
      await updatePassword(passwordForm);
      
      setPasswordNotification({
        type: 'success',
        message: 'Cập nhật mật khẩu thành công'
      });
      
      // Clear form
      setPasswordForm({
        currentPassword: '',
        newPassword: ''
      });
      setConfirmPassword('');
      
      // Clear notification after 3 seconds
      setTimeout(() => {
        setPasswordNotification({
          type: null,
          message: ''
        });
      }, 3000);
    } catch (error: any) {
      console.error('Password update error:', error);
      
      setPasswordNotification({
        type: 'error',
        message: error.message || 'Đã xảy ra lỗi khi cập nhật mật khẩu'
      });
    } finally {
      setPasswordSubmitting(false);
    }
  };
  
  // Handle resend verification email
  const handleResendVerification = async () => {
    try {
      const result = await resendVerification();
      
      setVerificationNotification({
        type: result.success ? 'success' : 'error',
        message: result.message
      });
      
      // Clear notification after 5 seconds
      setTimeout(() => {
        setVerificationNotification({
          type: null,
          message: ''
        });
      }, 5000);
    } catch (error: any) {
      console.error('Resend verification error:', error);
      
      setVerificationNotification({
        type: 'error',
        message: 'Đã xảy ra lỗi khi gửi lại email xác thực'
      });
    }
  };
  
  if (!user) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }
  
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Thông tin tài khoản</h1>
      
      {/* Email verification notice */}
      {!user.isEmailVerified && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
          <div className="flex">
            <div>
              <p className="text-sm text-yellow-700">
                Email của bạn chưa được xác thực. Vui lòng kiểm tra hộp thư để xác thực email.
              </p>
              
              <button
                onClick={handleResendVerification}
                className="mt-2 text-sm text-yellow-800 font-medium hover:text-yellow-900"
              >
                Gửi lại email xác thực
              </button>
              
              {verificationNotification.type && (
                <div className="mt-2">
                  <p className={`text-sm ${
                    verificationNotification.type === 'success' ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {verificationNotification.message}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* User Information */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-4">Thông tin cá nhân</h2>
          
          {/* Profile notification */}
          {profileNotification.type && (
            <div className={`p-3 mb-4 rounded-md ${
              profileNotification.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
            }`}>
              <div className="flex items-center">
                {profileNotification.type === 'success' ? (
                  <CheckCircle size={18} className="mr-2 text-green-500" />
                ) : (
                  <AlertCircle size={18} className="mr-2 text-red-500" />
                )}
                <p>{profileNotification.message}</p>
              </div>
            </div>
          )}
          
          <form onSubmit={handleProfileSubmit}>
            {/* Email (readonly) */}
            <div className="mb-4">
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail size={18} className="text-gray-400" />
                </div>
                <input
                  type="email"
                  id="email"
                  className="pl-10 w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50"
                  value={user.email}
                  readOnly
                />
              </div>
              <div className="mt-1 flex items-center">
                <span className={`text-xs px-2 py-1 rounded ${
                  user.isEmailVerified 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-yellow-100 text-yellow-800'
                }`}>
                  {user.isEmailVerified ? 'Đã xác thực' : 'Chưa xác thực'}
                </span>
              </div>
            </div>
            
            {/* Username (readonly) */}
            <div className="mb-4">
              <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">
                Tên đăng nhập
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <AtSign size={18} className="text-gray-400" />
                </div>
                <input
                  type="text"
                  id="username"
                  className="pl-10 w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50"
                  value={user.username}
                  readOnly
                />
              </div>
            </div>
            
            {/* First Name */}
            <div className="mb-4">
              <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-1">
                Họ
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User size={18} className="text-gray-400" />
                </div>
                <input
                  type="text"
                  id="firstName"
                  name="firstName"
                  className={`pl-10 w-full px-3 py-2 border ${
                    profileErrors.firstName ? 'border-red-500' : 'border-gray-300'
                  } rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500`}
                  value={profileForm.firstName}
                  onChange={handleProfileChange}
                />
              </div>
              {profileErrors.firstName && (
                <p className="mt-1 text-xs text-red-500">{profileErrors.firstName}</p>
              )}
            </div>
            
            {/* Last Name */}
            <div className="mb-4">
              <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-1">
                Tên
              </label>
              <input
                type="text"
                id="lastName"
                name="lastName"
                className={`w-full px-3 py-2 border ${
                  profileErrors.lastName ? 'border-red-500' : 'border-gray-300'
                } rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500`}
                value={profileForm.lastName}
                onChange={handleProfileChange}
              />
              {profileErrors.lastName && (
                <p className="mt-1 text-xs text-red-500">{profileErrors.lastName}</p>
              )}
            </div>
            
            {/* Phone Number */}
            <div className="mb-4">
              <label htmlFor="phoneNumber" className="block text-sm font-medium text-gray-700 mb-1">
                Số điện thoại
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Phone size={18} className="text-gray-400" />
                </div>
                <input
                  type="tel"
                  id="phoneNumber"
                  name="phoneNumber"
                  className={`pl-10 w-full px-3 py-2 border ${
                    profileErrors.phoneNumber ? 'border-red-500' : 'border-gray-300'
                  } rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500`}
                  value={profileForm.phoneNumber}
                  onChange={handleProfileChange}
                />
              </div>
              {profileErrors.phoneNumber && (
                <p className="mt-1 text-xs text-red-500">{profileErrors.phoneNumber}</p>
              )}
            </div>
            
            {/* Submit button */}
            <button
              type="submit"
              disabled={profileSubmitting}
              className="w-full bg-[#b75e41] text-white py-2 px-4 rounded-md font-medium hover:bg-[#a34e32] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {profileSubmitting ? 'Đang xử lý...' : 'Cập nhật thông tin'}
            </button>
          </form>
        </div>
        
        {/* Password Update */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-4">Đổi mật khẩu</h2>
          
          {/* Password notification */}
          {passwordNotification.type && (
            <div className={`p-3 mb-4 rounded-md ${
              passwordNotification.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
            }`}>
              <div className="flex items-center">
                {passwordNotification.type === 'success' ? (
                  <CheckCircle size={18} className="mr-2 text-green-500" />
                ) : (
                  <AlertCircle size={18} className="mr-2 text-red-500" />
                )}
                <p>{passwordNotification.message}</p>
              </div>
            </div>
          )}
          
          <form onSubmit={handlePasswordSubmit}>
            {/* Current Password */}
            <div className="mb-4">
              <label htmlFor="currentPassword" className="block text-sm font-medium text-gray-700 mb-1">
                Mật khẩu hiện tại
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock size={18} className="text-gray-400" />
                </div>
                <input
                  type={showCurrentPassword ? "text" : "password"}
                  id="currentPassword"
                  name="currentPassword"
                  className={`pl-10 w-full px-3 py-2 border ${
                    passwordErrors.currentPassword ? 'border-red-500' : 'border-gray-300'
                  } rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500`}
                  value={passwordForm.currentPassword}
                  onChange={handlePasswordChange}
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  tabIndex={-1}
                >
                  {showCurrentPassword ? (
                    <EyeOff size={18} className="text-gray-400" />
                  ) : (
                    <Eye size={18} className="text-gray-400" />
                  )}
                </button>
              </div>
              {passwordErrors.currentPassword && (
                <p className="mt-1 text-xs text-red-500">{passwordErrors.currentPassword}</p>
              )}
            </div>
            
            {/* New Password */}
            <div className="mb-4">
              <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 mb-1">
                Mật khẩu mới
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock size={18} className="text-gray-400" />
                </div>
                <input
                  type={showNewPassword ? "text" : "password"}
                  id="newPassword"
                  name="newPassword"
                  className={`pl-10 w-full px-3 py-2 border ${
                    passwordErrors.newPassword ? 'border-red-500' : 'border-gray-300'
                  } rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500`}
                  value={passwordForm.newPassword}
                  onChange={handlePasswordChange}
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  tabIndex={-1}
                >
                  {showNewPassword ? (
                    <EyeOff size={18} className="text-gray-400" />
                  ) : (
                    <Eye size={18} className="text-gray-400" />
                  )}
                </button>
              </div>
              {passwordErrors.newPassword && (
                <p className="mt-1 text-xs text-red-500">{passwordErrors.newPassword}</p>
              )}
              <p className="mt-1 text-xs text-gray-500">
                Mật khẩu phải chứa ít nhất 8 ký tự, bao gồm chữ hoa, chữ thường và số.
              </p>
            </div>
            
            {/* Confirm New Password */}
            <div className="mb-4">
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                Xác nhận mật khẩu mới
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock size={18} className="text-gray-400" />
                </div>
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  id="confirmPassword"
                  name="confirmPassword"
                  className={`pl-10 w-full px-3 py-2 border ${
                    passwordErrors.confirmPassword ? 'border-red-500' : 'border-gray-300'
                  } rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500`}
                  value={confirmPassword}
                  onChange={handlePasswordChange}
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  tabIndex={-1}
                >
                  {showConfirmPassword ? (
                    <EyeOff size={18} className="text-gray-400" />
                  ) : (
                    <Eye size={18} className="text-gray-400" />
                  )}
                </button>
              </div>
              {passwordErrors.confirmPassword && (
                <p className="mt-1 text-xs text-red-500">{passwordErrors.confirmPassword}</p>
              )}
            </div>
            
            {/* Submit button */}
            <button
              type="submit"
              disabled={passwordSubmitting}
              className="w-full bg-[#b75e41] text-white py-2 px-4 rounded-md font-medium hover:bg-[#a34e32] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {passwordSubmitting ? 'Đang xử lý...' : 'Đổi mật khẩu'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
