import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Button, Tabs, Modal, Space, Tag, Image, Typography, Descriptions } from 'antd';
import { ArrowLeftOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import type { ProductVariant, VariantFormData } from '../../../variants/interfaces/interface';
import { useProduct } from '../../hooks/useProducts';
import { useCreateVariant, useDeleteVariant, useProductVariants, useUpdateVariant } from '../../../variants/hooks/useVariants';
import { useProductCustomizations } from '../../../customizations/hooks/useCustomizations';
import LoadingState from '../../../../components/shared/LoadingState';
import { urlUtils } from '../../../../config/api_cli.config';
import { formatCurrency, formatDateTime } from '../../../../utils/format';
import VariantList from '../../../variants/components/VariantList';
import CustomizationList from '../../../customizations/components/CustomizationList';
import VariantForm from '../../../variants/components/VariantForm';


const { TabPane } = Tabs;
const { Title, Text } = Typography;

const ProductDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [isVariantModalVisible, setIsVariantModalVisible] = useState(false);
  const [editingVariant, setEditingVariant] = useState<ProductVariant | null>(null);


  const { data: productData, isLoading: isLoadingProduct } = useProduct(id!);
  
 
  const { data: variantsData, isLoading: isLoadingVariants } = useProductVariants(id!);
  

  const { data: customizationsData, isLoading: isLoadingCustomizations } = useProductCustomizations(id!);

  console.log('Product ID:', id);
  console.log('Product Data:', productData);
  console.log('Variants Data:', variantsData?.data?.variants);
  console.log('Customizations Data:', customizationsData);

  const createVariantMutation = useCreateVariant();
  const updateVariantMutation = useUpdateVariant();
  const deleteVariantMutation = useDeleteVariant();

  const product = productData?.data.product;
  const variants = variantsData?.data?.variants || [];

  // Variant handlers
  const handleVariantModalOpen = (variant?: ProductVariant) => {
    setEditingVariant(variant || null);
    setIsVariantModalVisible(true);
  };

  const handleVariantModalClose = () => {
    setIsVariantModalVisible(false);
    setEditingVariant(null);
  };

  const handleVariantSubmit = async (data: VariantFormData) => {
    try {
      if (editingVariant) {
        await updateVariantMutation.mutateAsync({
          productId: id!,
          variantId: editingVariant._id,
          data
        });
      } else {
        await createVariantMutation.mutateAsync({
          productId: id!,
          data
        });
      }
      handleVariantModalClose();
    } catch (error) {
      console.error('Failed to save variant:', error);
    }
  };

  const handleVariantDelete = (variantId: string) => {
    deleteVariantMutation.mutate({ productId: id!, variantId });
  };

  // Navigate to customizations page
  const handleManageCustomizations = () => {
    navigate(`/products/${id}/customizations`);
  };

  if (isLoadingProduct) {
    return <LoadingState message="Loading product..." />;
  }

  if (!product) {
    return (
      <div className="p-6">
        <div className="text-center">
          <h2>Product not found</h2>
          <Button onClick={() => navigate('/products')}>Back to Products</Button>
        </div>
      </div>
    );
  }

  const imageUrl = product.images?.[0]?.url 
    ? urlUtils.getFullImageUrl(product.images[0].url)
    : urlUtils.getFallbackImageUrl();

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <Title level={2}>{product.name}</Title>
        <Space>
          <Button
            icon={<EditOutlined />}
            onClick={() => navigate(`/products/${id}/edit`)}
          >
            Edit Product
          </Button>
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate('/products')}
          >
            Back to Products
          </Button>
        </Space>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <Card className="lg:col-span-1">
          <div className="text-center">
            <Image
              src={imageUrl || undefined}
              alt={product.name}
              style={{ maxWidth: '100%', maxHeight: 300 }}
              fallback={urlUtils.getFallbackImageUrl()}
            />
            <div className="mt-4">
              <Text className="text-2xl font-bold text-blue-600">
                {formatCurrency(product.basePrice)}
              </Text>
            </div>
            <div className="mt-2">
              <Space wrap>
                <Tag color={product.stockQuantity > 0 ? 'green' : 'red'}>
                  {product.stockQuantity > 0 ? `${product.stockQuantity} in stock` : 'Out of stock'}
                </Tag>
                {product.featured && <Tag color="blue">Featured</Tag>}
                {product.isCustomizable && <Tag color="purple">Customizable</Tag>}
              </Space>
            </div>
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <Descriptions column={2} bordered>
            <Descriptions.Item label="Name">{product.name}</Descriptions.Item>
            <Descriptions.Item label="SKU">{product.sku}</Descriptions.Item>
            <Descriptions.Item label="Category">{product.categoryId?.name}</Descriptions.Item>
            <Descriptions.Item label="Base Price">{formatCurrency(product.basePrice)}</Descriptions.Item>
            <Descriptions.Item label="Stock Quantity">{product.stockQuantity}</Descriptions.Item>
            <Descriptions.Item label="Weight">{product.weight ? `${product.weight} kg` : 'N/A'}</Descriptions.Item>
            <Descriptions.Item label="Created">{formatDateTime(product.createdAt)}</Descriptions.Item>
            <Descriptions.Item label="Updated">{formatDateTime(product.updatedAt)}</Descriptions.Item>
            <Descriptions.Item label="Description" span={2}>
              {product.description}
            </Descriptions.Item>
            {product.tags && product.tags.length > 0 && (
              <Descriptions.Item label="Tags" span={2}>
                <Space wrap>
                  {product.tags.map((tag: string) => (
                    <Tag key={tag}>{tag}</Tag>
                  ))}
                </Space>
              </Descriptions.Item>
            )}
          </Descriptions>
        </Card>
      </div>

      <Card>
        <Tabs defaultActiveKey="variants">
          <TabPane tab="Variants" key="variants">
            <div className="flex justify-between items-center mb-4">
              <Title level={4}>Product Variants</Title>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => handleVariantModalOpen()}
              >
                Add Variant
              </Button>
            </div>
            
            <VariantList
              variants={variants}
              loading={isLoadingVariants}
              onEdit={handleVariantModalOpen}
              onDelete={handleVariantDelete}
              basePrice={product.basePrice}
            />
          </TabPane>
          <TabPane tab="Customizations" key="customizations">
            <div className="flex justify-between items-center mb-4">
              <Title level={4}>Product Customizations</Title>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={handleManageCustomizations}
              >
                Manage Customizations
              </Button>
            </div>
            
            <CustomizationList
              customizations={customizationsData || []}
              loading={isLoadingCustomizations}
              showActions={false} // Read-only view in product detail
            />
            
            {(!customizationsData || customizationsData.length === 0) && (
              <div className="text-center py-8 text-gray-500">
                <p>No customizations configured for this product.</p>
                <p className="text-sm">Click "Manage Customizations" to add customization options.</p>
              </div>
            )}
          </TabPane>
          <TabPane tab="Images" key="images">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {product.images?.map((image: { url: string; altText?: string; isDefault?: boolean }, index: number) => (
                <div key={index} className="border rounded-lg overflow-hidden">
                  <Image
                    src={urlUtils.getFullImageUrl(image.url) || undefined}
                    alt={image.altText || `Product image ${index + 1}`}
                    style={{ width: '100%', height: 200, objectFit: 'cover' }}
                    fallback={urlUtils.getFallbackImageUrl()}
                  />
                  <div className="p-2">
                    <Text className="text-sm text-gray-500">
                      {image.altText || `Image ${index + 1}`}
                    </Text>
                    {image.isDefault && (
                      <Tag color="blue" className="ml-2">Default</Tag>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </TabPane>

          <TabPane tab="Details" key="details">
            <Descriptions column={1} bordered>
              <Descriptions.Item label="Product ID">{product._id}</Descriptions.Item>
              <Descriptions.Item label="Slug">{product.slug}</Descriptions.Item>
              <Descriptions.Item label="Average Rating">{product.averageRating || 'No ratings yet'}</Descriptions.Item>
              <Descriptions.Item label="Popularity">{product.popularity || 0}</Descriptions.Item>
              {product.dimensions && (
                <Descriptions.Item label="Dimensions">
                  {`${product.dimensions.length} x ${product.dimensions.width} x ${product.dimensions.height} ${product.dimensions.unit}`}
                </Descriptions.Item>
              )}
            </Descriptions>
          </TabPane>
        </Tabs>
      </Card>

      <Modal
        title={editingVariant ? 'Edit Variant' : 'Add Variant'}
        open={isVariantModalVisible}
        onCancel={handleVariantModalClose}
        footer={null}
        width={1000}
        destroyOnClose
      >
        <VariantForm
          variant={editingVariant || undefined}
          onSubmit={handleVariantSubmit}
          onCancel={handleVariantModalClose}
          isLoading={createVariantMutation.isLoading || updateVariantMutation.isLoading}
        />
      </Modal>
    </div>
  );
};

export default ProductDetailPage;