import { useNavigate } from 'react-router-dom';
import { Card, Button, Modal } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import type { ProductFilters, Product } from '../../services/productService';
import { useState } from 'react';
import { useDeleteProduct, useProducts, useRestoreProduct } from '../../hooks/useProducts';
import LoadingState from '../../../../components/shared/LoadingState';
import ProductFiltersComponent from '../../components/product/ProductFilters';
import ProductList from '../../components/product/ProductList';
const ProductListPage: React.FC = () => {
  const navigate = useNavigate();
  const [filters, setFilters] = useState<ProductFilters>({
    page: 1,
    limit: 10,
    sort: '-createdAt'
  });
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isRestoreModalVisible, setIsRestoreModalVisible] = useState(false);

  // Fetch products (categories will be fetched by ProductFiltersComponent)
  const { data: productsData, isLoading } = useProducts(filters);

  // Log productsData to inspect its content
  console.log('productsData in ProductListPage:', productsData);

  // Mutations
  const deleteProductMutation = useDeleteProduct();
  const restoreProductMutation = useRestoreProduct();

  const handleFiltersChange = (newFilters: Partial<ProductFilters>) => {
    setFilters({ ...filters, ...newFilters, page: 1 });
  };

  const handleClearFilters = () => {
    setFilters({
      page: 1,
      limit: 10,
      sort: '-createdAt'
    });
  };

  const handleTableChange = (pagination: any, _tableFilters: any, sorter: any) => {
    const newFilters: Partial<ProductFilters> = {
      page: pagination.current,
      limit: pagination.pageSize
    };

    if (sorter.field) {
      newFilters.sort = `${sorter.order === 'descend' ? '-' : ''}${sorter.field}`;
    }

    setFilters({ ...filters, ...newFilters });
  };

  const handleEdit = (product: Product) => {
    navigate(`/products/${product._id}/edit`);
  };

  const handleDelete = (id: string) => {
    deleteProductMutation.mutate(id);
  };

  const handleRestore = (product: Product) => {
    setSelectedProduct(product);
    setIsRestoreModalVisible(true);
  };

  const handleConfirmRestore = () => {
    if (selectedProduct) {
      restoreProductMutation.mutate(selectedProduct._id);
      setIsRestoreModalVisible(false);
      setSelectedProduct(null);
    }
  };

  const handleView = (product: Product) => {
    navigate(`/products/${product._id}`);
  };

  if (isLoading && !productsData) {
    return <LoadingState message="Loading products..." />;
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold">Products Management</h1>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => navigate('/products/add')}
        >
          Add Product
        </Button>
      </div>

 
      <ProductFiltersComponent
        filters={filters}
        onFiltersChange={handleFiltersChange}
        onClear={handleClearFilters}
      />

      <Card>
        <ProductList
          products={productsData?.data?.products || []}
          loading={isLoading}
          pagination={{
            current: productsData?.data?.pagination?.currentPage || 1,
            pageSize: productsData?.data?.pagination?.limit || 10,
            total: productsData?.data?.pagination?.totalItems || 0,
            showSizeChanger: true,
            showQuickJumper: true
          }}
          onTableChange={handleTableChange}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onRestore={(id) => {
            const product = productsData?.data?.products.find((p: Product) => p._id === id);
            if (product) handleRestore(product);
          }}
          onView={handleView}
        />
      </Card>

      <Modal
        title="Restore Product"
        open={isRestoreModalVisible}
        onOk={handleConfirmRestore}
        onCancel={() => {
          setIsRestoreModalVisible(false);
          setSelectedProduct(null);
        }}
        confirmLoading={restoreProductMutation.isLoading}
      >
        <p>Are you sure you want to restore this product?</p>
        <p className="font-semibold">{selectedProduct?.name}</p>
      </Modal>
    </div>
  );
};

export default ProductListPage;