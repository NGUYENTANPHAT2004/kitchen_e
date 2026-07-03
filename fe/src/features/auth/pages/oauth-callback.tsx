// src/features/auth/pages/OAuthCallbackPage.tsx
import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader } from 'lucide-react';
import authService from '../services/auth-service';

const OAuthCallbackPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    const processOAuthCallback = async () => {
      // Get token from URL
      const token = searchParams.get('token');
      
      if (token) {
        // Store token in localStorage
        localStorage.setItem('token', token);

        // Load user data before redirecting so auth context is populated
        try {
          await authService.getCurrentUser();
        } catch {
          // non-fatal — context will retry on mount
        }

        // Redirect to home page
        navigate('/shop');
      } else {
        // If no token, check for error
        const errorMessage = searchParams.get('error');
        if (errorMessage) {
          setError(errorMessage);
        } else {
          setError('Xác thực không thành công. Vui lòng thử lại.');
        }
        setTimeout(() => {
          navigate('/auth');
        }, 3000);
      }
    };
    
    processOAuthCallback();
  }, [searchParams, navigate]);
  
  return (
    <div className="min-h-screen bg-[#f8f5f2] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-lg shadow-md text-center">
        <h1 className="text-3xl font-serif font-bold mb-1">Our Place</h1>
        
        {error ? (
          <>
            <div className="text-red-600 mb-4">
              <p className="text-xl font-medium">Xác thực thất bại</p>
              <p className="mt-2">{error}</p>
              <p className="mt-2">Đang chuyển hướng về trang đăng nhập...</p>
            </div>
            <div className="mt-4">
              <button 
                onClick={() => navigate('/auth')}
                className="bg-[#b75e41] text-white py-2 px-4 rounded-md font-medium hover:bg-[#a34e32] transition-colors"
              >
                Quay lại đăng nhập
              </button>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-10">
            <Loader size={48} className="text-[#b75e41] animate-spin mb-4" />
            <p className="text-xl font-medium">Đang xử lý xác thực...</p>
            <p className="mt-2 text-gray-600">Vui lòng đợi trong giây lát.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default OAuthCallbackPage;
