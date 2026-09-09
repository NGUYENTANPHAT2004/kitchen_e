import { useQuery } from "@tanstack/react-query";
import { api } from "../../config/api_cli.config";

export interface StoreSettings {
  storeName: string;
  contactEmail: string;
  contactPhone: string;
  address: string;
  standardShipping: number;
  expressShipping: number;
  freeShippingThreshold: number;
  bankName: string;
  bankAccount: string;
  bankAccountName: string;
}
export const defaultSettings: StoreSettings = {
  storeName: "Kitchen E",
  contactEmail: "",
  contactPhone: "",
  address: "",
  standardShipping: 30000,
  expressShipping: 50000,
  freeShippingThreshold: 500000,
  bankName: "",
  bankAccount: "",
  bankAccountName: "",
};
export const useStoreSettings = () =>
  useQuery<StoreSettings>({
    queryKey: ["store-settings"],
    queryFn: async () => (await api.get("/settings/public")).data.data.settings,
    staleTime: 60000,
  });
