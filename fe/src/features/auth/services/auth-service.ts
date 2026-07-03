import { api } from '../../../config/api_cli.config';
import type {
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  RegisterResponse,
  UpdateUserRequest,
  UpdatePasswordRequest,
  VerificationResponse,
} from '../interfaces/auth-interfaces';
import type { User } from '../../../types/user';

const AUTH_BASE = '/auth';

function parseToken(token: string): { exp: number } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    return JSON.parse(atob(parts[1]));
  } catch {
    return null;
  }
}

class AuthService {
  private userCache: User | null = null;
  private lastFetchTime = 0;
  private readonly CACHE_DURATION = 2 * 60 * 1000;
  private readonly MIN_FETCH_INTERVAL = 30 * 1000;

  // --- Token helpers ---

  getToken(): string | null {
    const token = localStorage.getItem('token');
    return token && token !== 'undefined' && token !== 'null' ? token : null;
  }

  getTokenExpirationTime(): number | null {
    const token = this.getToken();
    if (!token) return null;
    const payload = parseToken(token);
    return payload ? payload.exp * 1000 : null;
  }

  getTimeUntilExpiration(): number {
    const exp = this.getTokenExpirationTime();
    return exp ? Math.max(0, exp - Date.now()) : 0;
  }

  isAuthenticated(): boolean {
    const token = this.getToken();
    if (!token) return false;
    const payload = parseToken(token);
    if (!payload) {
      this.clearAuthData();
      return false;
    }
    const isExpired = payload.exp < Date.now() / 1000 + 5 * 60;
    if (isExpired) this.clearAuthData();
    return !isExpired;
  }

  // --- Storage helpers ---

  static setUserData(user: User): void {
    if (!user?._id || !user?.email) return;
    try {
      localStorage.setItem('user', JSON.stringify(user));
      localStorage.setItem('lastUserFetch', Date.now().toString());
    } catch {
      // ignore storage errors
    }
  }

  clearAuthData(): void {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('lastUserFetch');
    this.userCache = null;
    this.lastFetchTime = 0;
  }

  getCachedUser(): User | null {
    try {
      const raw = localStorage.getItem('user');
      if (!raw || raw === 'undefined' || raw === 'null') {
        localStorage.removeItem('user');
        return null;
      }
      const user = JSON.parse(raw) as User;
      if (!user?._id || !user?.email) {
        localStorage.removeItem('user');
        return null;
      }
      this.userCache = user;
      return user;
    } catch {
      localStorage.removeItem('user');
      return null;
    }
  }

  // --- API methods ---

  async getCurrentUser(): Promise<{ user: User }> {
    const now = Date.now();
    const lastFetch = localStorage.getItem('lastUserFetch');
    const cacheAge = lastFetch ? now - parseInt(lastFetch) : Infinity;
    const isCacheFresh =
      this.userCache &&
      cacheAge < this.CACHE_DURATION &&
      now - this.lastFetchTime < this.MIN_FETCH_INTERVAL;

    if (isCacheFresh) return { user: this.userCache! };

    if (now - this.lastFetchTime < this.MIN_FETCH_INTERVAL) {
      const cached = this.getCachedUser();
      if (cached) return { user: cached };
    }

    if (!this.getToken()) throw new Error('No authentication token');

    this.lastFetchTime = now;
    try {
      const response = await api.get<{ data: { user: User } }>(`${AUTH_BASE}/me`);
      const user = response.data.data?.user;
      if (!user?._id || !user?.email) throw new Error('Invalid user data from API');
      this.userCache = user;
      AuthService.setUserData(user);
      return { user };
    } catch (error: any) {
      if (error.response?.status === 401) {
        this.clearAuthData();
        throw error;
      }
      const cached = this.getCachedUser();
      if (cached) return { user: cached };
      throw error;
    }
  }

  async refreshUser(): Promise<{ user: User }> {
    this.userCache = null;
    this.lastFetchTime = 0;
    localStorage.removeItem('lastUserFetch');
    return this.getCurrentUser();
  }

  async login(data: LoginRequest): Promise<LoginResponse> {
    const response = await api.post<LoginResponse>(`${AUTH_BASE}/login`, data);
    const { token, user } = response.data;

    if (!token) throw new Error('No token received from server');

    const payload = parseToken(token);
    if (!payload || payload.exp < Date.now() / 1000) {
      throw new Error('Received invalid or expired token');
    }

    localStorage.setItem('token', token);
    AuthService.setUserData(user);
    this.userCache = user;

    return response.data;
  }

  async register(data: RegisterRequest): Promise<RegisterResponse> {
    const response = await api.post<RegisterResponse>(`${AUTH_BASE}/register`, data);
    const token = response.data.token;
    const user = response.data.user ?? (response.data as any).data?.user;

    if (token) {
      localStorage.setItem('token', token);
      if (user) {
        AuthService.setUserData(user);
        this.userCache = user;
      }
    }

    return response.data;
  }

  async logout(): Promise<void> {
    try {
      if (this.getToken()) {
        await api.get(`${AUTH_BASE}/logout`);
      }
    } finally {
      this.clearAuthData();
    }
  }

  async updateUserProfile(data: UpdateUserRequest): Promise<{ user: User }> {
    const response = await api.put<{ data: { user: User } }>(`${AUTH_BASE}/me`, data);
    const user = response.data.data?.user;
    if (!user) throw new Error('Invalid response from server');
    this.userCache = user;
    AuthService.setUserData(user);
    return { user };
  }

  async updatePassword(data: UpdatePasswordRequest): Promise<LoginResponse> {
    const response = await api.put<LoginResponse>(`${AUTH_BASE}/password`, data);
    if (response.data.token) {
      localStorage.setItem('token', response.data.token);
      AuthService.setUserData(response.data.user);
      this.userCache = response.data.user;
    }
    return response.data;
  }

  async forgotPassword(email: string): Promise<VerificationResponse> {
    const response = await api.post<VerificationResponse>(`${AUTH_BASE}/forgot-password`, { email });
    return response.data;
  }

  async resetPassword(token: string, password: string): Promise<VerificationResponse> {
    const response = await api.post<VerificationResponse>(`${AUTH_BASE}/reset-password/${token}`, { password });
    return response.data;
  }

  async verifyEmail(token: string): Promise<VerificationResponse> {
    const response = await api.get<VerificationResponse>(`${AUTH_BASE}/verify-email/${token}`);
    return response.data;
  }

  async resendVerificationEmail(): Promise<VerificationResponse> {
    const response = await api.post<VerificationResponse>(`${AUTH_BASE}/resend-verification`);
    return response.data;
  }
}

export default new AuthService();
