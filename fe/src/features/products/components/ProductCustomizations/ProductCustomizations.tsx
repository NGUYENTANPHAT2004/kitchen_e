import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import {
  Table,
  Button,
  Space,
  Modal,
  Form,
  Input,
  Select,
  InputNumber,
  Switch,
  Card,
  Typography,
  Popconfirm,
  Upload,

} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  UploadOutlined
} from '@ant-design/icons';
import { api } from '../../../../config/api_cli.config';
import type { Customization, CustomizationOption } from '../../interface/productCustomization';

const { Option } = Select;
const { TextArea } = Input;
const { Title } = Typography;

const ProductCustomizations: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingCustomization, setEditingCustomization] = useState<Customization | null>(null);
  const [form] = Form.useForm();
  const queryClient = useQueryClient();

  // Fetch customizations
  const { data: customizations, isLoading } = useQuery({
    queryKey: ['product-customizations', id],
    queryFn: async () => {
      if (!id) {
        throw new Error('Product ID is required');
      }
      const response = await api.get(`/products/${id}/customizations`);
      return response.data.customizations;
    },
    enabled: !!id
  });

  // Create/Update customization mutation
  const mutation = useMutation({
    mutationFn: async (values: any) => {
      if (!id) {
        throw new Error('Product ID is required');
      }
      const formData = new FormData();
      
      // Add basic fields
      Object.keys(values).forEach(key => {
        if (key !== 'options') { // Exclude options from direct append, handle them separately
          formData.append(key, values[key]);
        }
      });

      // Add options as JSON string and handle images
      const optionsWithoutImages = values.options.map((option: CustomizationOption) => {
        const { image, ...rest } = option;
        return rest;
      });
      formData.append('options', JSON.stringify(optionsWithoutImages));

      // Add option images with correct field name
      values.options.forEach((option: CustomizationOption) => {
        if (option.image instanceof File) {
          formData.append('optionImages', option.image); // Use 'optionImages' for all files
        }
      });

      if (editingCustomization) {
        return api.put(`/products/${id}/customizations/${editingCustomization._id}`, formData);
      }
      return api.post(`/products/${id}/customizations`, formData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-customizations', id] });
      toast.success(`Customization ${editingCustomization ? 'updated' : 'created'} successfully`);
      handleModalClose();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || `Failed to ${editingCustomization ? 'update' : 'create'} customization`);
    }
  });

  // Delete customization mutation
  const deleteMutation = useMutation({
    mutationFn: async (customizationId: string) => {
      if (!id) {
        throw new Error('Product ID is required');
      }
      await api.delete(`/products/${id}/customizations/${customizationId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-customizations', id] });
      toast.success('Customization deleted successfully');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to delete customization');
    }
  });

  const handleModalOpen = (customization?: Customization) => {
    if (customization) {
      setEditingCustomization(customization);
      form.setFieldsValue({
        ...customization,
        options: customization.options.map(opt => ({
          ...opt,
          key: Math.random() // Add key for dynamic form
        }))
      });
    } else {
      setEditingCustomization(null);
      form.resetFields();
    }
    setIsModalVisible(true);
  };

  const handleModalClose = () => {
    setIsModalVisible(false);
    setEditingCustomization(null);
    form.resetFields();
  };

  const handleSubmit = async (values: any) => {
    try {
      await mutation.mutateAsync(values);
    } catch (error) {
      console.error('Error submitting form:', error);
    }
  };

  const columns = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: 'Type',
      dataIndex: 'customizationType',
      key: 'customizationType',
    },
    {
      title: 'Required',
      dataIndex: 'isRequired',
      key: 'isRequired',
      render: (isRequired: boolean) => (
        <span>{isRequired ? 'Yes' : 'No'}</span>
      ),
    },
    {
      title: 'Options',
      dataIndex: 'options',
      key: 'options',
      render: (options: CustomizationOption[]) => (
        <Space direction="vertical">
          {options.map((option, index) => (
            <div key={index}>
              {option.name}: {option.value}
              {option.priceAdjustment > 0 && ` (+${option.priceAdjustment})`}
            </div>
          ))}
        </Space>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'isActive',
      key: 'isActive',
      render: (isActive: boolean) => (
        <span>{isActive ? 'Active' : 'Inactive'}</span>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: Customization) => (
        <Space>
          <Button
            icon={<EditOutlined />}
            onClick={() => handleModalOpen(record)}
          />
          <Popconfirm
            title="Are you sure you want to delete this customization?"
            onConfirm={() => deleteMutation.mutate(record._id)}
            okText="Yes"
            cancelText="No"
          >
            <Button icon={<DeleteOutlined />} danger />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  if (!id) {
    return <div>Product ID is required</div>;
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <Title level={2}>Product Customizations</Title>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => handleModalOpen()}
        >
          Add Customization
        </Button>
      </div>

      <Table
        columns={columns}
        dataSource={customizations}
        loading={isLoading}
        rowKey="_id"
      />

      <Modal
        title={editingCustomization ? 'Edit Customization' : 'Add Customization'}
        open={isModalVisible}
        onCancel={handleModalClose}
        footer={null}
        width={800}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={{
            isRequired: false,
            isActive: true,
            displayOrder: 0,
            options: [{ key: Math.random() }]
          }}
        >
          <Form.Item
            name="name"
            label="Name"
            rules={[{ required: true, message: 'Please enter customization name' }]}
          >
            <Input />
          </Form.Item>

          <Form.Item
            name="customizationType"
            label="Type"
            rules={[{ required: true, message: 'Please select customization type' }]}
          >
            <Select>
              <Option value="select">Select</Option>
              <Option value="radio">Radio</Option>
              <Option value="checkbox">Checkbox</Option>
              <Option value="text">Text</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="description"
            label="Description"
          >
            <TextArea rows={3} />
          </Form.Item>

          <Form.Item
            name="isRequired"
            label="Required"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>

          <Form.Item
            name="isActive"
            label="Active"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>

          <Form.Item
            name="displayOrder"
            label="Display Order"
          >
            <InputNumber min={0} />
          </Form.Item>

          <Form.List name="options">
            {(fields, { add, remove }) => (
              <>
                {fields.map((field, index) => (
                  <Card
                    key={field.key}
                    title={`Option ${index + 1}`}
                    extra={
                      <Button
                        type="text"
                        danger
                        onClick={() => remove(field.name)}
                        disabled={fields.length === 1}
                      >
                        Delete
                      </Button>
                    }
                    className="mb-4"
                  >
                    <Form.Item
                      {...field}
                      name={[field.name, 'name']}
                      label="Name"
                      rules={[{ required: true, message: 'Please enter option name' }]}
                    >
                      <Input />
                    </Form.Item>

                    <Form.Item
                      {...field}
                      name={[field.name, 'value']}
                      label="Value"
                      rules={[{ required: true, message: 'Please enter option value' }]}
                    >
                      <Input />
                    </Form.Item>

                    <Form.Item
                      {...field}
                      name={[field.name, 'priceAdjustment']}
                      label="Price Adjustment"
                    >
                      <InputNumber
                        min={0}
                        prefix="₫"
                        style={{ width: '100%' }}
                      />
                    </Form.Item>

                    <Form.Item
                      {...field}
                      name={[field.name, 'isDefault']}
                      label="Default"
                      valuePropName="checked"
                    >
                      <Switch />
                    </Form.Item>

                    <Form.Item
                      {...field}
                      name={[field.name, 'image']}
                      label="Image"
                      // Ant Design Upload component passes file as an array of objects
                      valuePropName="fileList"
                      getValueFromEvent={(e) => e?.fileList}
                    >
                      <Upload
                        listType="picture"
                        maxCount={1}
                        beforeUpload={() => false} // Prevent auto upload
                        accept="image/*"
                      >
                        <Button icon={<UploadOutlined />}>Upload Image</Button>
                      </Upload>
                    </Form.Item>
                  </Card>
                ))}

                <Button
                  type="dashed"
                  onClick={() => add()} // Add an empty option initially
                  block
                  icon={<PlusOutlined />}
                >
                  Add Option
                </Button>
              </>
            )}
          </Form.List>

          <div className="flex justify-end mt-6">
            <Space>
              <Button onClick={handleModalClose}>Cancel</Button>
              <Button type="primary" htmlType="submit" loading={mutation.isLoading}>
                {editingCustomization ? 'Update' : 'Create'}
              </Button>
            </Space>
          </div>
        </Form>
      </Modal>
    </div>
  );
};
export default ProductCustomizations;
