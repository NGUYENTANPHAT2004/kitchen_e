import React from 'react';
import { Table, Button, Space, Popconfirm, Tag, Image, Tooltip } from 'antd';
import { EditOutlined, DeleteOutlined, RestOutlined, EyeOutlined } from '@ant-design/icons';
import type { Product } from '../../services/productService';
import { formatCurrency, formatDateTime } from '../../../../utils/format';
import { urlUtils } from '../../../../config/api_cli.config';

interface ProductListProps {
  products: Product[];
  loading?: boolean;
  pagination?: {
    current: number;
    pageSize: number;
    total: number;
    showSizeChanger?: boolean;
    showQuickJumper?: boolean;
  };
  onTableChange?: (pagination: any, filters: any, sorter: any) => void;
  onEdit?: (product: Product) => void;
  onDelete?: (id: string) => void;
  onRestore?: (id: string) => void;
  onView?: (product: Product) => void;
  showActions?: boolean;
}

const ProductList: React.FC<ProductListProps> = ({
  products,
  loading = false,
  pagination,
  onTableChange,
  onEdit,
  onDelete,
  onRestore,
  onView,
  showActions = true
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
            alt="Product"
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
      sorter: true,
      render: (text: string, record: Product) => (
        <div>
          <div className="font-medium">{text}</div>
          <div className="text-sm text-gray-500">SKU: {record.sku}</div>
        </div>
      )
    },
    {
      title: 'Category',
      dataIndex: ['categoryId', 'name'],
      key: 'category',
      sorter: true
    },
    {
      title: 'Price',
      dataIndex: 'basePrice',
      key: 'price',
      sorter: true,
      render: (price: number) => (
        <span className="font-medium text-blue-600">
          {formatCurrency(price)}
        </span>
      )
    },
    {
      title: 'Stock',
      dataIndex: 'stockQuantity',
      key: 'stock',
      sorter: true,
      render: (stock: number) => (
        <Tag color={stock > 0 ? 'green' : 'red'}>
          {stock > 0 ? `${stock} in stock` : 'Out of stock'}
        </Tag>
      )
    },
    {
      title: 'Status',
      key: 'status',
      render: (_: any, record: Product) => (
        <Space direction="vertical" size="small">
          {record.featured && <Tag color="blue">Featured</Tag>}
          {record.isCustomizable && <Tag color="purple">Customizable</Tag>}
          {record.isDeleted && <Tag color="red">Deleted</Tag>}
        </Space>
      )
    },
    {
      title: 'Created',
      dataIndex: 'createdAt',
      key: 'createdAt',
      sorter: true,
      render: (date: string) => formatDateTime(date)
    }
  ];

  if (showActions) {
    columns.push({
      title: 'Actions',
      key: 'actions',
      width: 120,
      render: (_: any, record: Product) => (
        <Space>
          {onView && (
            <Tooltip title="View">
              <Button
                type="text"
                size="small"
                icon={<EyeOutlined />}
                onClick={() => onView(record)}
              />
            </Tooltip>
          )}
          
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
                title="Are you sure you want to delete this product?"
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
      dataSource={products}
      rowKey="_id"
      loading={loading}
      pagination={pagination}
      onChange={onTableChange}
      scroll={{ x: 1200 }}
      rowClassName={(record) => record.isDeleted ? 'opacity-60' : ''}
    />
  );
};

export default ProductList;