// src/features/auth/hooks/useAuth.ts
import { useContext } from 'react';
import { AuthContext } from '../contexts/auth-context-value';

/**
 * Custom hook to use the auth context
 * @returns Auth context
 */
export const useAuth = () => {
  const context = useContext(AuthContext);
  
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  
  return context;
};
