import React from 'react';
import { Button, Space, Switch, Spin, Alert, Modal } from 'antd';
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { useQueryClient } from '@tanstack/react-query';
import CategoryTable from './CategoryTable';
import CategoryForm from './CategoryForm';
import CategoryErrorBoundary from './CategoryErrorBoundary';
import { useCategoryManagement } from '../../hooks/useCategoryManagement';
import { categoryUtils } from '../../hooks/useCategories';
import type { Category } from '../../interface/interface';

const CategoryManagement: React.FC = () => {
  const {
    form,
    isModalVisible,
    editingCategory,
    fileList,
    showDeleted,
    setShowDeleted,
    previewVisible,
    setPreviewVisible,
    previewImage,
    previewTitle,
    uploading,
    categories,
    isLoading,
    error,
    refetch,
    saveMutation,
    deleteMutation,
    restoreMutation,
    handleSubmit,
    openModal,
    closeModal,
    handlePreview,
    beforeUpload,
    handleFileChange,
  } = useCategoryManagement();

  const queryClient = useQueryClient();

  const { treeCategories, filteredCategories } = React.useMemo(() => {
    const tree = categoryUtils.buildCategoryTree(categories);
    const flat = flattenWithLevel(tree);
    return {
      treeCategories: tree,
      filteredCategories: showDeleted ? flat : flat.filter(c => !c.isDeleted),
    };
  }, [categories, showDeleted]);

  if (error) {
    return (
      <div className="p-6">
        <Alert
          message="Failed to Load Categories"
          description={(error as Error)?.message || 'An error occurred while loading categories.'}
          type="error"
          showIcon
          action={
            <Space>
              <Button onClick={() => refetch()} icon={<ReloadOutlined />}>Retry</Button>
              <Button onClick={() => queryClient.invalidateQueries({ queryKey: ['categories'] })}>
                Clear Cache & Retry
              </Button>
            </Space>
          }
        />
      </div>
    );
  }

  return (
    <CategoryErrorBoundary>
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-semibold">Category Management</h1>
            <p className="text-gray-600 mt-1">Manage product categories and hierarchy</p>
          </div>
          <Space>
            <Switch
              checked={showDeleted}
              onChange={setShowDeleted}
              checkedChildren="Show Deleted"
              unCheckedChildren="Hide Deleted"
            />
            <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()} disabled={isLoading}>
              Add Category
            </Button>
            <Button icon={<ReloadOutlined />} onClick={() => refetch()} loading={isLoading}>
              Refresh
            </Button>
          </Space>
        </div>

        <Spin spinning={isLoading} tip="Loading categories...">
          <CategoryTable
            data={filteredCategories}
            isLoading={isLoading}
            onEdit={openModal}
            onDelete={(id) => deleteMutation.mutate(id)}
            onRestore={(id) => restoreMutation.mutate(id)}
            isDeleting={deleteMutation.isLoading}
            isRestoring={restoreMutation.isLoading}
          />
        </Spin>

        <Modal
          title={editingCategory ? 'Edit Category' : 'Add New Category'}
          open={isModalVisible}
          onCancel={closeModal}
          footer={null}
          width={800}
          destroyOnClose
        >
          <CategoryForm
            form={form}
            editingCategory={editingCategory}
            treeCategories={treeCategories}
            fileList={fileList}
            uploading={uploading}
            isSubmitting={saveMutation.isLoading}
            onFinish={handleSubmit}
            onCancel={closeModal}
            onPreview={handlePreview}
            onFileChange={handleFileChange}
            beforeUpload={beforeUpload}
          />
        </Modal>

        <Modal
          open={previewVisible}
          title={previewTitle}
          footer={null}
          onCancel={() => setPreviewVisible(false)}
        >
          <img alt="preview" style={{ width: '100%' }} src={previewImage} />
        </Modal>
      </div>
    </CategoryErrorBoundary>
  );
};

function flattenWithLevel(cats: (Category & { level?: number })[], level = 0): (Category & { level: number })[] {
  let result: (Category & { level: number })[] = [];
  const sorted = [...cats].sort((a, b) => {
    const diff = (a.displayOrder || 0) - (b.displayOrder || 0);
    return diff !== 0 ? diff : (a.name || '').localeCompare(b.name || '');
  });
  for (const cat of sorted) {
    if (cat?._id) {
      result.push({ ...cat, level });
      if (cat.subcategories?.length) {
        result = result.concat(flattenWithLevel(cat.subcategories, level + 1));
      }
    }
  }
  return result;
}

export default CategoryManagement;
