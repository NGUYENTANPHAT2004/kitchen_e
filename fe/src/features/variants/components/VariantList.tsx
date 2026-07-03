import React from 'react';
import { Table, Button, Space, Popconfirm, Tag, Image, Tooltip } from 'antd';
import { EditOutlined, DeleteOutlined, RestOutlined } from '@ant-design/icons';
import type { ProductVariant } from '../interfaces/interface';
import { urlUtils } from '../../../config/api_cli.config';
import { formatCurrency } from '../../../utils/format';


interface VariantListProps {
  variants: ProductVariant[];
  loading?: boolean;
  onEdit?: (variant: ProductVariant) => void;
  onDelete?: (variantId: string) => void;
  onRestore?: (variantId: string) => void;
  showActions?: boolean;
  basePrice?: number;
}

const VariantList: React.FC<VariantListProps> = ({
  variants,
  loading = false,
  onEdit,
  onDelete,
  onRestore,
  showActions = true,
  basePrice = 0
}) => {
  const columns = [
    {
      title: 'Image',
      dataIndex: 'images',
      key: 'image',
      width: 80,
      render: (images: any[]) => {
        const imageUrl = images?.[0]?.url 
          ? urlUtils.getFullImageUrl(images[0].url)
          : urlUtils.getFallbackImageUrl();
        
        return (
          <Image
            src={imageUrl || undefined}
            alt="Variant"
            width={50}
            height={50}
            style={{ objectFit: 'cover', borderRadius: 4 }}
            fallback={urlUtils.getFallbackImageUrl()}
            preview={false}
          />
        );
      }
    },
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: ProductVariant) => (
        <div>
          <div className="font-medium">{text}</div>
          <div className="text-sm text-gray-500">SKU: {record.sku}</div>
        </div>
      )
    },
    {
      title: 'Attributes',
      key: 'attributes',
      render: (_: any, record: ProductVariant) => (
        <Space direction="vertical" size="small">
          {record.color && <Tag color="blue">Color: {record.color}</Tag>}
          {record.size && <Tag color="green">Size: {record.size}</Tag>}
          {record.material && <Tag color="purple">Material: {record.material}</Tag>}
        </Space>
      )
    },
    {
      title: 'Price',
      key: 'price',
      render: (_: any, record: ProductVariant) => {
        const finalPrice = basePrice + record.priceAdjustment;
        return (
          <div>
            <div className="font-medium text-blue-600">
              {formatCurrency(finalPrice)}
            </div>
            {record.priceAdjustment !== 0 && (
              <div className={`text-sm ${record.priceAdjustment > 0 ? 'text-green-600' : 'text-red-600'}`}>
                {record.priceAdjustment > 0 ? '+' : ''}{formatCurrency(record.priceAdjustment)}
              </div>
            )}
          </div>
        );
      }
    },
    {
      title: 'Stock',
      dataIndex: 'stockQuantity',
      key: 'stock',
      render: (stock: number) => (
        <Tag color={stock > 0 ? 'green' : 'red'}>
          {stock > 0 ? `${stock} in stock` : 'Out of stock'}
        </Tag>
      )
    },
    {
      title: 'Status',
      key: 'status',
      render: (_: any, record: ProductVariant) => (
        <Space direction="vertical" size="small">
          <Tag color={record.isActive ? 'green' : 'red'}>
            {record.isActive ? 'Active' : 'Inactive'}
          </Tag>
          {record.isDeleted && <Tag color="red">Deleted</Tag>}
        </Space>
      )
    }
  ];

  if (showActions) {
    columns.push({
      title: 'Actions',
      key: 'actions',
      width: 120,
      render: (_: any, record: ProductVariant) => (
        <Space>
          {onEdit && (
            <Tooltip title="Edit">
              <Button
                type="text"
                size="small"
                icon={<EditOutlined />}
                onClick={() => onEdit(record)}
              />
            </Tooltip>
          )}
          
          {record.isDeleted ? (
            onRestore && (
              <Tooltip title="Restore">
                <Button
                  type="text"
                  size="small"
                  icon={<RestOutlined />}
                  onClick={() => onRestore(record._id)}
                />
              </Tooltip>
            )
          ) : (
            onDelete && (
              <Popconfirm
                title="Are you sure you want to delete this variant?"
                onConfirm={() => onDelete(record._id)}
                okText="Yes"
                cancelText="No"
              >
                <Tooltip title="Delete">
                  <Button
                    type="text"
                    size="small"
                    danger
                    icon={<DeleteOutlined />}
                  />
                </Tooltip>
              </Popconfirm>
            )
          )}
        </Space>
      )
    } as any);
  }

  return (
    <Table
      columns={columns}
      dataSource={variants}
      rowKey="_id"
      loading={loading}
      pagination={false}
      scroll={{ x: 1000 }}
      rowClassName={(record) => record.isDeleted ? 'opacity-60' : ''}
    />
  );
};

export default VariantList;