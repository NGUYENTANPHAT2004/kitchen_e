import { api, endpoints } from '../../../config/api_cli.config';
import type { Bundle, BundlePagination, BundleListParams } from '../interface/interface';

const bundleService = {
  async getBundles(params: BundleListParams = {}) {
    const query = new URLSearchParams();
    if (params.page) query.set('page', String(params.page));
    if (params.limit) query.set('limit', String(params.limit));
    if (params.sort) query.set('sort', params.sort);
    if (params.active) query.set('active', 'true');
    if (params.featured) query.set('featured', 'true');
    if (params.search) query.set('search', params.search);
    const response = await api.get(`${endpoints.bundles.base}?${query.toString()}`);
    return response.data.data as { bundles: Bundle[]; pagination: BundlePagination };
  },

  async getBundle(id: string) {
    const response = await api.get(endpoints.bundles.byId(id));
    return response.data.data as { bundle: Bundle };
  },

  async deleteBundle(id: string) {
    const response = await api.delete(endpoints.bundles.byId(id));
    return response.data;
  },

  async updateBundle(id: string, data: Partial<Bundle>) {
    const response = await api.put(endpoints.bundles.byId(id), data);
    return response.data.data as { bundle: Bundle };
  },
};

export default bundleService;
