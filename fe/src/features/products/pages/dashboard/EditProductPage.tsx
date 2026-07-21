import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Button } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import ProductForm from '../../components/product/ProductForm.tsx';
import LoadingState from '../../../../components/shared/LoadingState.tsx';
import { useProduct, useUpdateProduct } from '../../hooks/useProducts.ts';
import type { ProductFormData } from '../../services/productService';

const EditProductPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const updateProductMutation = useUpdateProduct();

  // Fetch product
  const { data: productData, isLoading: isLoadingProduct } = useProduct(id!);
  
  const handleSubmit = async (data: ProductFormData) => {
    try {
      await updateProductMutation.mutateAsync({ id: id!, data });
      navigate('/products');
    } catch (error) {
      console.error('Failed to update product:', error);
    }
  };

  const handleCancel = () => {
    navigate('/products');
  };

  if (isLoadingProduct) {
    return <LoadingState message="Loading product..." />;
  }

  if (!productData?.data.product) {
    return (
      <div className="p-6">
        <div className="text-center">
          <h2>Product not found</h2>
          <Button onClick={handleCancel}>Back to Products</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Edit Product</h1>
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={handleCancel}
        >
          Back to Products
        </Button>
      </div>

      <Card>
        <ProductForm
          product={productData.data.product}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          isLoading={updateProductMutation.isLoading}
        />
      </Card>
    </div>
  );
};

export default EditProductPage;
