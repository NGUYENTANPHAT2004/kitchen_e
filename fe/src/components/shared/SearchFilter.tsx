import React from 'react';
import { Input, Select, Button } from 'antd';
import { SearchOutlined, ClearOutlined } from '@ant-design/icons';

interface FilterOption {
  value: string;
  label: string;
}

interface SearchFilterProps {
  searchValue?: string;
  onSearchChange: (value: string) => void;
  filters?: {
    key: string;
    placeholder: string;
    options: FilterOption[];
    value?: string;
    onChange: (value: string) => void;
  }[];
  onClear?: () => void;
  className?: string;
}

const SearchFilter: React.FC<SearchFilterProps> = ({
  searchValue = '',
  onSearchChange,
  filters = [],
  onClear,
  className = ''
}) => {
  return (
    <div className={`flex gap-4 mb-4 ${className}`}>
      <Input
        placeholder="Search..."
        prefix={<SearchOutlined />}
        value={searchValue}
        onChange={(e) => onSearchChange(e.target.value)}
        style={{ width: 300 }}
        allowClear
      />
      
      {filters.map((filter) => (
        <Select
          key={filter.key}
          placeholder={filter.placeholder}
          allowClear
          style={{ width: 200 }}
          value={filter.value}
          onChange={filter.onChange}
        >
          {filter.options.map((option) => (
            <Select.Option key={option.value} value={option.value}>
              {option.label}
            </Select.Option>
          ))}
        </Select>
      ))}
      
      {onClear && (
        <Button
          icon={<ClearOutlined />}
          onClick={onClear}
        >
          Clear All
        </Button>
      )}
    </div>
  );
};

export default SearchFilter;
