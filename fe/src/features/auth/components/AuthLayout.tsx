import React from "react";
import { CheckCircle, AlertCircle } from "lucide-react";
import { Link } from "react-router-dom";

interface AuthLayoutProps {
  children: React.ReactNode;
  title: string;
  notification?: {
    type: "success" | "error";
    message: string;
  };
}

const AuthLayout: React.FC<AuthLayoutProps> = ({
  children,
  title,
  notification,
}) => {
  return (
    <div className="auth-shell min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-lg shadow-md">
        {/* Logo và tiêu đề */}
        <div className="text-center">
          <Link className="brand" to="/shop/home">
            kitchene.
          </Link>
          <h2 className="text-xl font-medium">{title}</h2>
        </div>

        {/* Thông báo lỗi hoặc thành công */}
        {notification && (
          <div
            className={`p-3 rounded-md ${
              notification.type === "success"
                ? "bg-green-50 text-green-700"
                : "bg-red-50 text-red-700"
            }`}
          >
            <div className="flex items-center">
              {notification.type === "success" ? (
                <CheckCircle size={18} className="mr-2 text-green-500" />
              ) : (
                <AlertCircle size={18} className="mr-2 text-red-500" />
              )}
              <p>{notification.message}</p>
            </div>
          </div>
        )}

        {/* Form content */}
        {children}

        {/* Phần footer */}
        <div className="pt-4 border-t border-gray-200">
          <div className="flex items-center justify-center space-x-4 text-sm text-gray-600">
            <Link to="/shop/support" className="hover:text-gray-900">
              Hỗ trợ
            </Link>
            <span>·</span>
            <Link to="/shop/privacy" className="hover:text-gray-900">
              Bảo mật
            </Link>
            <span>·</span>
            <Link to="/shop/home" className="hover:text-gray-900">
              Cửa hàng
            </Link>
          </div>
          <p className="mt-3 text-center text-xs text-gray-500">
            © {new Date().getFullYear()} Kitchen E
          </p>
        </div>
      </div>
    </div>
  );
};

export default AuthLayout;
