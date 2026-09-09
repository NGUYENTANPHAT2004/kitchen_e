import React from "react";
import { useQuery } from "@tanstack/react-query";
import { categoryService } from "../../../features/category/service/categoryService";
import type { Category } from "../../../features/category/interface/interface";
import { CategoriesContext } from "./categories-context";
import ClientHeader from "./ClientHeader";
import ClientFooter from "./ClientFooter";
import AssistantWidget from "../../../features/ai/pages/client/AssistantWidget";

interface ClientLayoutProps {
  children: React.ReactNode;
}

const ClientLayout: React.FC<ClientLayoutProps> = ({ children }) => {
  const { data: categoriesData } = useQuery({
    queryKey: ["categories-client"],
    queryFn: () => categoryService.getCategories(),
    staleTime: 10 * 60 * 1000,
  });

  const categories: Category[] = categoriesData || [];

  return (
    <CategoriesContext.Provider value={categories}>
      <div className="store-shell">
        <ClientHeader categories={categories} />

        <main className="flex-1">{children}</main>

        <ClientFooter categories={categories} />
        <AssistantWidget />
      </div>
    </CategoriesContext.Provider>
  );
};

export default ClientLayout;
