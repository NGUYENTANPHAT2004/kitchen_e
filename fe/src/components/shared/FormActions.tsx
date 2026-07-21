import React from 'react';
import { Space, Button } from 'antd';
import { SaveOutlined } from '@ant-design/icons';

interface FormActionsProps {
  onCancel: () => void;
  onSubmit?: () => void;
  isLoading?: boolean;
  isEditMode?: boolean;
  submitText?: string;
  cancelText?: string;
  disabled?: boolean;
}

const FormActions: React.FC<FormActionsProps> = ({
  onCancel,
  onSubmit,
  isLoading = false,
  isEditMode = false,
  submitText,
  cancelText = 'Cancel',
  disabled = false
}) => {
  const defaultSubmitText = isEditMode ? 'Update' : 'Create';

  return (
    <div className="flex justify-end pt-6 border-t border-gray-200">
      <Space>
        <Button 
          onClick={onCancel}
          disabled={isLoading}
        >
          {cancelText}
        </Button>
        <Button
          type="primary"
          htmlType="submit"
          icon={<SaveOutlined />}
          loading={isLoading}
          disabled={disabled}
          onClick={onSubmit}
        >
          {submitText || defaultSubmitText}
        </Button>
      </Space>
    </div>
  );
};

export default FormActions;