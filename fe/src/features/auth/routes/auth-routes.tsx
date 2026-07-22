// src/features/auth/routes/authRoutes.tsx
import { Navigate, type RouteObject } from 'react-router-dom';
import VerifyEmailPage from '../components/VerifyEmail/verify-email-page';
import OAuthCallbackPage from '../pages/oauth-callback';
import RegisterForm from '../components/Register/register-component';
import ForgotPasswordForm from '../components/ForgotPassword/forgot-password-component';
import ResetPasswordForm from '../components/ResetPassword/reset-password-component';
import LoginForm from '../components/Login/login-component';

// Create auth routes with proper route protection
export const authRoutes: RouteObject[] = [
  {
    path: 'auth',
    children: [
      {
        index: true,
        element: <Navigate to="/auth/login" replace />
      },
      {
        path: 'register',
        element: <RegisterForm />
      },
      {
        path: 'login',
        element: <LoginForm />
      },
      {
        path: 'forgot-password',
        element: <ForgotPasswordForm />
      },
      {
        path: 'reset-password',
        element: <ResetPasswordForm />
      },
      {
        path: 'verify-email',
        element: <VerifyEmailPage />
      },
      {
        path: 'oauth-callback',
        element: <OAuthCallbackPage />
      }
    ]
  },
 
];
