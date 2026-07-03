import React, { createContext, useContext, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { categoryService } from '../../../features/category/service/categoryService';
import type { Category } from '../../../features/category/interface/interface';
import ClientHeader from './ClientHeader';
import ClientFooter from './ClientFooter';

const CategoriesContext = createContext<Category[]>([]);
export const useCategories = () => useContext(CategoriesContext);

interface ClientLayoutProps {
  children: React.ReactNode;
}

const ClientLayout: React.FC<ClientLayoutProps> = ({ children }) => {
  const [cookieAccepted, setCookieAccepted] = useState(() => {
    return localStorage.getItem('cookie-consent') === 'accepted';
  });

  const { data: categoriesData } = useQuery({
    queryKey: ['categories-client'],
    queryFn: () => categoryService.getCategories(),
    staleTime: 10 * 60 * 1000,
  });

  const categories: Category[] = categoriesData || [];

  const handleAcceptCookies = () => {
    localStorage.setItem('cookie-consent', 'accepted');
    setCookieAccepted(true);
  };

  return (
    <CategoriesContext.Provider value={categories}>
      <div className="min-h-screen bg-[#f8f5f2] text-gray-800 font-sans flex flex-col">
        {!cookieAccepted && (
          <div className="fixed bottom-0 left-0 right-0 bg-white shadow-lg border-t z-50 px-4 py-3 flex justify-between items-center text-sm">
            <p className="text-xs md:text-sm">
              Kitchen E sử dụng cookies để cải thiện trải nghiệm của bạn.
            </p>
            <div className="flex items-center gap-2">
              <button className="text-xs underline" onClick={handleAcceptCookies}>Quản lý Cookies</button>
              <button
                className="bg-gray-800 text-white px-3 py-1 rounded-md text-xs"
                onClick={handleAcceptCookies}
              >
                Chấp nhận
              </button>
            </div>
          </div>
        )}

        <ClientHeader categories={categories} />

        <main className="flex-1">
          {children}
        </main>

        <ClientFooter categories={categories} />
      </div>
    </CategoriesContext.Provider>
  );
};

export default ClientLayout;
