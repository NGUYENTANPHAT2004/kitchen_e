import React from 'react';
import { Select, TreeSelect, Spin, Alert } from 'antd';
import { categoryUtils, useCategoriesForProducts } from '../../../category/hooks/useCategories';


interface CategorySelectProps {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  allowClear?: boolean;
  treeSelect?: boolean; // Use TreeSelect or regular Select
  disabled?: boolean;
  style?: React.CSSProperties;
}

const CategorySelect: React.FC<CategorySelectProps> = ({
  value,
  onChange,
  placeholder = "Select category",
  allowClear = true,
  treeSelect = false,
  disabled = false,
  style
}) => {
  const { data: categories, isLoading, error } = useCategoriesForProducts();

  if (error) {
    return (
      <Alert
        message="Failed to load categories"
        type="error"
        showIcon
      />
    );
  }

  if (isLoading) {
    return (
      <Select
        placeholder="Loading categories..."
        disabled
        style={style}
        suffixIcon={<Spin size="small" />}
      />
    );
  }

  if (!categories || categories.length === 0) {
    return (
      <Select
        placeholder="No categories available"
        disabled
        style={style}
      />
    );
  }

  if (treeSelect) {
    const treeData = categoryUtils.buildTreeSelectData(categories);
    
    return (
      <TreeSelect
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        allowClear={allowClear}
        disabled={disabled}
        style={style}
        treeData={treeData}
        treeDefaultExpandAll
        showSearch
        treeNodeFilterProp="title"
        dropdownStyle={{ maxHeight: 400, overflow: 'auto' }}
      />
    );
  } else {
    const selectData = categoryUtils.buildFlatSelectData(categories);
    
    return (
      <Select
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        allowClear={allowClear}
        disabled={disabled}
        style={style}
        showSearch
        filterOption={(input, option) =>
          (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
        }
        options={selectData}
        dropdownStyle={{ maxHeight: 400, overflow: 'auto' }}
      />
    );
  }
};

export default CategorySelect;