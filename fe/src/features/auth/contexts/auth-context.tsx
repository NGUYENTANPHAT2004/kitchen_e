import React, { useReducer, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import type {
  AuthState,
  LoginRequest,
  RegisterRequest,
  UpdateUserRequest,
  UpdatePasswordRequest,
} from '../interfaces/auth-interfaces';
import type { User } from '../../../types/user';
import authService from '../services/auth-service';
import { AuthContext } from './auth-context-value';

const initialState: AuthState = {
  isAuthenticated: false,
  user: null,
  loading: true,
  error: null,
};

type AuthAction =
  | { type: 'LOGIN_SUCCESS'; payload: User }
  | { type: 'REGISTER_SUCCESS'; payload: User }
  | { type: 'AUTH_ERROR'; payload: string }
  | { type: 'USER_LOADED'; payload: User }
  | { type: 'UPDATE_USER'; payload: User }
  | { type: 'LOGOUT' }
  | { type: 'CLEAR_ERROR' }
  | { type: 'SET_LOADING' }
  | { type: 'TOKEN_EXPIRED' }
  | { type: 'NETWORK_ERROR'; payload: string };

function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case 'LOGIN_SUCCESS':
    case 'REGISTER_SUCCESS':
    case 'USER_LOADED':
      return { ...state, isAuthenticated: true, user: action.payload, loading: false, error: null };
    case 'UPDATE_USER':
      return { ...state, user: action.payload, loading: false, error: null };
    case 'AUTH_ERROR':
      return { ...state, isAuthenticated: false, user: null, loading: false, error: action.payload };
    case 'NETWORK_ERROR':
      return { ...state, loading: false, error: action.payload };
    case 'TOKEN_EXPIRED':
      return {
        ...state,
        isAuthenticated: false,
        user: null,
        loading: false,
        error: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
      };
    case 'LOGOUT':
      return { ...state, isAuthenticated: false, user: null, loading: false, error: null };
    case 'CLEAR_ERROR':
      return { ...state, error: null };
    case 'SET_LOADING':
      return { ...state, loading: true };
    default:
      return state;
  }
}

const MIN_LOAD_USER_INTERVAL = 30_000;
const TOKEN_CHECK_INTERVAL = 5 * 60_000;
const RETRY_DELAYS = [2000, 5000, 10000];
const MAX_RETRIES = 3;

function getErrorMessage(error: any, fallback: string): string {
  if (!error.response) return 'Không thể kết nối đến server. Vui lòng kiểm tra kết nối mạng.';
  return error.response?.data?.error?.message || fallback;
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);
  const navigate = useNavigate();

  const tokenCheckInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const retryTimeouts = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());
  const isMounted = useRef(true);
  const lastLoadUserTime = useRef(0);
  const retryCount = useRef(0);

  useEffect(() => {
    isMounted.current = true;
    const timeouts = retryTimeouts.current;
    return () => {
      isMounted.current = false;
      if (tokenCheckInterval.current) clearInterval(tokenCheckInterval.current);
      timeouts.forEach(clearTimeout);
      timeouts.clear();
    };
  }, []);

  const loadUser = useCallback(async (isRetry = false, forceRefresh = false) => {
    if (!isMounted.current) return;

    const now = Date.now();
    if (!forceRefresh && !isRetry && now - lastLoadUserTime.current < MIN_LOAD_USER_INTERVAL) return;

    if (!authService.isAuthenticated()) {
      dispatch({ type: 'AUTH_ERROR', payload: 'No valid authentication token' });
      return;
    }

    if (!forceRefresh && !isRetry) {
      const cached = authService.getCachedUser();
      if (cached) {
        dispatch({ type: 'USER_LOADED', payload: cached });
        return;
      }
    }

    lastLoadUserTime.current = now;

    try {
      const { user } = await authService.getCurrentUser();
      if (isMounted.current) {
        dispatch({ type: 'USER_LOADED', payload: user });
        retryCount.current = 0;
      }
    } catch (error: any) {
      if (!isMounted.current) return;

      retryCount.current++;

      if (error.response?.status === 401) {
        dispatch({ type: 'TOKEN_EXPIRED' });
        return;
      }

      if (retryCount.current >= MAX_RETRIES) {
        const msg = error.response?.status === 429
          ? 'Server đang bận. Vui lòng thử lại sau.'
          : 'Không thể tải thông tin người dùng. Vui lòng đăng nhập lại.';
        dispatch({ type: error.response ? 'AUTH_ERROR' : 'NETWORK_ERROR', payload: msg });
        return;
      }

      const delay = RETRY_DELAYS[retryCount.current - 1] ?? 10000;
      const timeout = setTimeout(() => {
        retryTimeouts.current.delete(timeout);
        if (isMounted.current) loadUser(true, forceRefresh);
      }, delay);
      retryTimeouts.current.add(timeout);
    }
  }, []);

  // Token expiration monitoring
  useEffect(() => {
    if (!state.isAuthenticated) {
      if (tokenCheckInterval.current) {
        clearInterval(tokenCheckInterval.current);
        tokenCheckInterval.current = null;
      }
      return;
    }

    tokenCheckInterval.current = setInterval(() => {
      if (!isMounted.current) return;
      const timeLeft = authService.getTimeUntilExpiration();
      if (timeLeft <= 0) {
        dispatch({ type: 'TOKEN_EXPIRED' });
        if (tokenCheckInterval.current) clearInterval(tokenCheckInterval.current);
      }
    }, TOKEN_CHECK_INTERVAL);

    return () => {
      if (tokenCheckInterval.current) clearInterval(tokenCheckInterval.current);
    };
  }, [state.isAuthenticated]);

  useEffect(() => {
    loadUser();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const login = async (data: LoginRequest) => {
    try {
      dispatch({ type: 'SET_LOADING' });
      const response = await authService.login(data);
      if (!isMounted.current) return;
      dispatch({ type: 'LOGIN_SUCCESS', payload: response.user });
      const redirect = new URLSearchParams(window.location.search).get('redirect') || '/shop';
      navigate(redirect);
    } catch (error: any) {
      if (!isMounted.current) return;
      let msg = 'Đăng nhập thất bại. Vui lòng thử lại.';
      if (!error.response) msg = 'Không thể kết nối đến server.';
      else if (error.response.status === 401) msg = 'Email hoặc mật khẩu không đúng.';
      else if (error.response.status === 429) msg = 'Quá nhiều lần thử. Vui lòng thử lại sau.';
      else msg = getErrorMessage(error, msg);
      dispatch({ type: 'AUTH_ERROR', payload: msg });
    }
  };

  const register = async (data: RegisterRequest) => {
    try {
      dispatch({ type: 'SET_LOADING' });
      const response = await authService.register(data);
      if (!isMounted.current) return;
      dispatch({ type: 'REGISTER_SUCCESS', payload: response.user });
      navigate('/shop');
    } catch (error: any) {
      if (!isMounted.current) return;
      let msg = 'Đăng ký thất bại. Vui lòng thử lại.';
      if (!error.response) msg = 'Không thể kết nối đến server.';
      else if (error.response.status === 400) msg = getErrorMessage(error, 'Thông tin đăng ký không hợp lệ.');
      else if (error.response.status === 409) msg = 'Email hoặc tên đăng nhập đã được sử dụng.';
      dispatch({ type: 'AUTH_ERROR', payload: msg });
    }
  };

  const logout = async () => {
    if (tokenCheckInterval.current) clearInterval(tokenCheckInterval.current);
    retryTimeouts.current.forEach(clearTimeout);
    retryTimeouts.current.clear();
    try {
      await authService.logout();
    } finally {
      if (isMounted.current) {
        dispatch({ type: 'LOGOUT' });
        navigate('/auth');
      }
    }
  };

  const updateUser = async (data: UpdateUserRequest) => {
    try {
      dispatch({ type: 'SET_LOADING' });
      const { user } = await authService.updateUserProfile(data);
      if (isMounted.current) dispatch({ type: 'UPDATE_USER', payload: user });
    } catch (error: any) {
      if (!isMounted.current) return;
      if (error.response?.status === 401) { dispatch({ type: 'TOKEN_EXPIRED' }); return; }
      dispatch({ type: 'AUTH_ERROR', payload: getErrorMessage(error, 'Cập nhật thông tin thất bại.') });
      throw error;
    }
  };

  const updatePassword = async (data: UpdatePasswordRequest) => {
    try {
      dispatch({ type: 'SET_LOADING' });
      const response = await authService.updatePassword(data);
      if (isMounted.current) dispatch({ type: 'LOGIN_SUCCESS', payload: response.user });
    } catch (error: any) {
      if (!isMounted.current) return;
      let msg = 'Cập nhật mật khẩu thất bại.';
      if (!error.response) msg = 'Không thể kết nối đến server.';
      else if (error.response.status === 401) msg = 'Mật khẩu hiện tại không đúng.';
      else msg = getErrorMessage(error, msg);
      dispatch({ type: 'AUTH_ERROR', payload: msg });
      throw error;
    }
  };

  const refreshUser = async () => {
    const now = Date.now();
    if (now - lastLoadUserTime.current < 5000) return;
    await loadUser(true, true);
  };

  const forgotPassword = async (email: string) => {
    try {
      const res = await authService.forgotPassword(email);
      return { success: true, message: res.message };
    } catch (error: any) {
      return { success: false, message: getErrorMessage(error, 'Không thể gửi email đặt lại mật khẩu.') };
    }
  };

  const resetPassword = async (token: string, password: string) => {
    try {
      const res = await authService.resetPassword(token, password);
      return { success: true, message: res.message };
    } catch (error: any) {
      return { success: false, message: getErrorMessage(error, 'Đặt lại mật khẩu thất bại.') };
    }
  };

  const verifyEmail = async (token: string) => {
    try {
      const res = await authService.verifyEmail(token);
      if (state.user && isMounted.current) {
        dispatch({ type: 'UPDATE_USER', payload: { ...state.user, isEmailVerified: true } });
      }
      return { success: true, message: res.message };
    } catch (error: any) {
      return { success: false, message: getErrorMessage(error, 'Xác thực email thất bại.') };
    }
  };

  const resendVerification = async () => {
    try {
      const res = await authService.resendVerificationEmail();
      return { success: true, message: res.message };
    } catch (error: any) {
      return { success: false, message: getErrorMessage(error, 'Gửi lại email xác thực thất bại.') };
    }
  };

  const clearError = useCallback(() => dispatch({ type: 'CLEAR_ERROR' }), []);

  return (
    <AuthContext.Provider
      value={{
        state,
        login,
        register,
        logout,
        updateUser,
        updatePassword,
        forgotPassword,
        resetPassword,
        verifyEmail,
        resendVerification,
        refreshUser,
        clearError,
        loadUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
