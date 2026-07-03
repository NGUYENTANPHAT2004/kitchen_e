import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Button } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import ProductForm from '../../components/product/ProductForm.tsx';
import { useCreateProduct } from '../../hooks/useProducts.ts';
import type { ProductFormData } from '../../services/productService';

const AddProductPage: React.FC = () => {
  const navigate = useNavigate();
  const createProductMutation = useCreateProduct();

  const handleSubmit = async (data: ProductFormData) => {
    try {
      await createProductMutation.mutateAsync(data);
      navigate('/products');
    } catch (error) {
      console.error('Failed to create product:', error);
    }
  };

  const handleCancel = () => {
    navigate('/products');
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Add New Product</h1>
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={handleCancel}
        >
          Back to Products
        </Button>
      </div>

      <Card>
        <ProductForm
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          isLoading={createProductMutation.isLoading}
        />
      </Card>
    </div>
  );
};

export default AddProductPage;