import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Button, Modal, Typography, Alert, Breadcrumb, message } from 'antd';
import { PlusOutlined, ArrowLeftOutlined, HomeOutlined, ShopOutlined } from '@ant-design/icons';
import { useProductCustomizations, useCreateCustomization, useUpdateCustomization, useDeleteCustomization } from '../../../customizations/hooks/useCustomizations';
import CustomizationList from '../../../customizations/components/CustomizationList';
import CustomizationForm from '../../../customizations/components/CustomizationForm';
import LoadingState from '../../../../components/shared/LoadingState';
import { useProduct } from '../../hooks/useProducts';
import type { Customization, CustomizationFormData } from '../../../customizations/interface/interface';

const { Title } = Typography;

interface ApiError {
  message: string;
}

const ProductCustomizationsPage: React.FC = () => {
  const { id: productId = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingCustomization, setEditingCustomization] = useState<Customization | null>(null);

  // Fetch product info
  const { data: productData, isLoading: isLoadingProduct } = useProduct(productId);

  // Fetch customizations
  const { data: customizations, isLoading, error, refetch } = useProductCustomizations(productId);

  const customizationsList: Customization[] = Array.isArray(customizations) ? customizations : [];

  // Mutations
  const createCustomizationMutation = useCreateCustomization();
  const updateCustomizationMutation = useUpdateCustomization();
  const deleteCustomizationMutation = useDeleteCustomization();

  const product = productData?.data.product;

  const handleModalOpen = (customization?: Customization) => {
    setEditingCustomization(customization || null);
    setIsModalVisible(true);
  };

  const handleModalClose = () => {
    setIsModalVisible(false);
    setEditingCustomization(null);
  };

  const handleSubmit = async (data: CustomizationFormData) => {
    try {
      
      if (editingCustomization) {
        await updateCustomizationMutation.mutateAsync({
          productId,
          customizationId: editingCustomization._id,
          data
        });
      } else {
        await createCustomizationMutation.mutateAsync({
          productId,
          data
        });
      }
      handleModalClose();
    } catch (error) {
      console.error('❌ ProductCustomizationsPage: Failed to save customization:', error);
      message.error((error as ApiError)?.message || 'Lưu tùy chỉnh thất bại.');
    }
  };

  const handleDelete = (customizationId: string) => {
    deleteCustomizationMutation.mutate({ productId, customizationId });
  };

  const handleBackToProduct = () => {
    navigate(`/products/${productId}`);
  };

  const handleBackToProducts = () => {
    navigate('/products');
  };

  // Loading state
  if (isLoadingProduct || (isLoading && !customizations)) {
    return <LoadingState message="Đang tải tùy chỉnh..." />;
  }

  // Handle product not found
  if (!product && !isLoadingProduct) {
    message.error('Không tìm thấy sản phẩm này.');
    navigate('/products');
    return null;
  }

  // Error state for customizations fetching
  if (error && (error as ApiError).message !== 'Failed to fetch customizations') {
    return (
      <div className="p-6">
        <Alert
          message="Tải tùy chỉnh thất bại"
          description={(error as ApiError).message}
          type="error"
          showIcon
          action={
            <Button onClick={() => refetch()}>
              Thử lại
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Breadcrumb */}
      <Breadcrumb className="mb-4">
        <Breadcrumb.Item>
          <Button 
            type="link" 
            icon={<HomeOutlined />} 
            onClick={handleBackToProducts}
            className="p-0"
          >
            Sản phẩm
          </Button>
        </Breadcrumb.Item>
        <Breadcrumb.Item>
          <Button 
            type="link" 
            onClick={handleBackToProduct}
            className="p-0"
          >
            {product?.name || 'Chi tiết sản phẩm'}
          </Button>
        </Breadcrumb.Item>
        <Breadcrumb.Item>Tùy chỉnh</Breadcrumb.Item>
      </Breadcrumb>

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <Title level={2}>Tùy chỉnh sản phẩm</Title>
          {product && (
            <p className="text-gray-600 mt-1">
              Quản lý tùy chỉnh cho: <span className="font-medium">{product.name}</span>
            </p>
          )}
        </div>
        
        <div className="flex gap-2">
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={handleBackToProduct}
          >
            Quay lại sản phẩm
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => handleModalOpen()}
          >
            Thêm tùy chỉnh
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <Card>
        <CustomizationList
          customizations={customizationsList}
          loading={isLoading}
          onEdit={handleModalOpen}
          onDelete={handleDelete}
        />
      </Card>

      {/* Modal */}
      <Modal
        title={editingCustomization ? 'Chỉnh sửa tùy chỉnh' : 'Thêm tùy chỉnh mới'}
        open={isModalVisible}
        onCancel={handleModalClose}
        footer={null}
        width={1000}
        destroyOnClose
      >
        <CustomizationForm
          customization={editingCustomization || undefined}
          onSubmit={handleSubmit}
          onCancel={handleModalClose}
          isLoading={createCustomizationMutation.isLoading || updateCustomizationMutation.isLoading}
        />
      </Modal>
    </div>
  );
};

export default ProductCustomizationsPage;