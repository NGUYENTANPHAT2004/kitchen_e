import React, { useState, useEffect } from 'react';
import { Save } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { toast } from 'react-hot-toast';

interface SystemSettingsForm {
  redis: {
    host: string;
    port: number;
    password: string;
    database: number;
  };
  imageOptimization: {
    enabled: boolean;
    quality: number;
    maxSize: number;
  };
}

const SystemSettings: React.FC = () => {
  const [formChanged, setFormChanged] = useState(false);
  const { register, handleSubmit, formState: { isDirty } } = useForm<SystemSettingsForm>({
    defaultValues: {
      redis: {
        host: '127.0.0.1',
        port: 6379,
        password: '',
        database: 0
      },
      imageOptimization: {
        enabled: true,
        quality: 80,
        maxSize: 1920
      }
    }
  });

  useEffect(() => {
    setFormChanged(isDirty);
  }, [isDirty]);

  const onSubmit = async (data: SystemSettingsForm) => {
    try {
      // TODO: Implement API call to save settings
      console.log('Saving settings:', data);
      toast.success('Cài đặt đã được lưu thành công');
      setFormChanged(false);
    } catch (error) {
      toast.error('Có lỗi xảy ra khi lưu cài đặt');
      console.error('Error saving settings:', error);
    }
  };

  const handleClearCache = async () => {
    try {
      // TODO: Implement API call to clear cache
      toast.success('Cache đã được xóa thành công');
    } catch (error) {
      toast.error('Có lỗi xảy ra khi xóa cache');
      console.error('Error clearing cache:', error);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="bg-white shadow rounded-lg">
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="px-6 py-4">
            {/* Redis Settings */}
            <div className="border-t border-gray-200 pt-4 mt-4">
              <div className="flex justify-between">
                <div>
                  <h4 className="text-md font-medium text-gray-800">Cài đặt Redis</h4>
                  <p className="mt-1 text-sm text-gray-500">Cấu hình kết nối Redis cache.</p>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
                <div className="sm:col-span-3">
                  <label htmlFor="redis-host" className="block text-sm font-medium text-gray-700">
                    Redis Host
                  </label>
                  <div className="mt-1">
                    <input
                      type="text"
                      id="redis-host"
                      {...register('redis.host')}
                      className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                    />
                  </div>
                </div>

                <div className="sm:col-span-3">
                  <label htmlFor="redis-port" className="block text-sm font-medium text-gray-700">
                    Redis Port
                  </label>
                  <div className="mt-1">
                    <input
                      type="number"
                      id="redis-port"
                      {...register('redis.port', { valueAsNumber: true })}
                      className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                    />
                  </div>
                </div>

                <div className="sm:col-span-3">
                  <label htmlFor="redis-password" className="block text-sm font-medium text-gray-700">
                    Redis Password
                  </label>
                  <div className="mt-1">
                    <input
                      type="password"
                      id="redis-password"
                      {...register('redis.password')}
                      className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                    />
                  </div>
                </div>

                <div className="sm:col-span-3">
                  <label htmlFor="redis-database" className="block text-sm font-medium text-gray-700">
                    Redis Database
                  </label>
                  <div className="mt-1">
                    <input
                      type="number"
                      id="redis-database"
                      {...register('redis.database', { valueAsNumber: true })}
                      className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Image Optimization Settings */}
            <div className="border-t border-gray-200 pt-4 mt-4">
              <div>
                <h4 className="text-md font-medium text-gray-800">Tối ưu hóa hình ảnh</h4>
                <p className="mt-1 text-sm text-gray-500">Cài đặt tối ưu hóa hình ảnh tự động.</p>
              </div>

              <div className="mt-4 space-y-4">
                <div className="flex items-start">
                  <div className="flex items-center h-5">
                    <input
                      id="image-optimization"
                      type="checkbox"
                      {...register('imageOptimization.enabled')}
                      className="focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-gray-300 rounded"
                    />
                  </div>
                  <div className="ml-3 text-sm">
                    <label htmlFor="image-optimization" className="font-medium text-gray-700">
                      Bật tối ưu hóa hình ảnh
                    </label>
                    <p className="text-gray-500">Tự động tối ưu hóa và nén hình ảnh khi tải lên.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
                  <div className="sm:col-span-3">
                    <label htmlFor="image-quality" className="block text-sm font-medium text-gray-700">
                      Chất lượng hình ảnh (%)
                    </label>
                    <div className="mt-1">
                      <input
                        type="number"
                        id="image-quality"
                        {...register('imageOptimization.quality', { 
                          valueAsNumber: true,
                          min: 1,
                          max: 100
                        })}
                        className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                      />
                    </div>
                  </div>

                  <div className="sm:col-span-3">
                    <label htmlFor="image-resize" className="block text-sm font-medium text-gray-700">
                      Kích thước tối đa (px)
                    </label>
                    <div className="mt-1">
                      <input
                        type="number"
                        id="image-resize"
                        {...register('imageOptimization.maxSize', { valueAsNumber: true })}
                        className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Clear Cache */}
            <div className="border-t border-gray-200 pt-4 mt-4">
              <div className="flex justify-between">
                <div>
                  <h4 className="text-md font-medium text-gray-800">Xóa Cache</h4>
                  <p className="mt-1 text-sm text-gray-500">Xóa dữ liệu cache hiện tại.</p>
                </div>
                <div>
                  <button
                    type="button"
                    onClick={handleClearCache}
                    className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                    Xóa Cache
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Form Actions */}
          <div className="px-6 py-4 bg-gray-50 flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={() => window.history.back()}
              className="px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={!formChanged}
              className={`px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${
                formChanged
                  ? 'bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500'
                  : 'bg-gray-300 cursor-not-allowed'
              }`}
            >
              <Save className="w-4 h-4 inline mr-1" />
              Lưu thay đổi
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SystemSettings;
