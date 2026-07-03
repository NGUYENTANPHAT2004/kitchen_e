import React, { useState } from 'react';
import { ArrowLeft, Book, Save } from 'lucide-react';
import { useCreateRecipe } from '../hooks/useRecipes';
import { useNavigate } from 'react-router-dom';
import type { RecipeIngredient, RecipeNutrition, RecipeStep } from '../interface/interface';
import RecipeBasicForm from '../components/RecipeBasicForm';
import RecipeIngredientForm from '../components/RecipeIngredientForm';
import RecipeStepsForm from '../components/RecipeStepsForm';
import RecipeNutritionForm from '../components/RecipeNutritionForm';

const AddRecipe: React.FC = () => {
  const createMutation = useCreateRecipe();
  const navigate = useNavigate();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [prepTime, setPrepTime] = useState('');
  const [cookTime, setCookTime] = useState('');
  const [servings, setServings] = useState('');
  const [difficulty, setDifficulty] = useState('medium');
  const [thumbnailUrl, setThumbnailUrl] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [featured, setFeatured] = useState(false);

  const [ingredients, setIngredients] = useState<RecipeIngredient[]>([
    { id: 'ing-1', name: '', quantity: '', unit: '' }
  ]);

  const [steps, setSteps] = useState<RecipeStep[]>([
    { id: 'step-1', content: '' }
  ]);

  const [nutrition, setNutrition] = useState<RecipeNutrition>({
    calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0
  });

  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [relatedProducts, setRelatedProducts] = useState<string[]>([]);
  const [productInput, setProductInput] = useState('');

  const [activeTab, setActiveTab] = useState<'basic' | 'ingredients' | 'steps' | 'nutrition'>('basic');
  const [formChanged, setFormChanged] = useState(false);

  const handleBasicChange = (field: string, value: string | boolean) => {
    setFormChanged(true);
    switch (field) {
      case 'title': setTitle(value as string); break;
      case 'description': setDescription(value as string); break;
      case 'category': setCategory(value as string); break;
      case 'prepTime': setPrepTime(value as string); break;
      case 'cookTime': setCookTime(value as string); break;
      case 'servings': setServings(value as string); break;
      case 'difficulty': setDifficulty(value as string); break;
      case 'thumbnailUrl': setThumbnailUrl(value as string); break;
      case 'videoUrl': setVideoUrl(value as string); break;
      case 'featured': setFeatured(value as boolean); break;
    }
  };

  const addIngredient = () => {
    setIngredients([...ingredients, { id: `ing-${Date.now()}`, name: '', quantity: '', unit: '' }]);
    setFormChanged(true);
  };

  const updateIngredient = (id: string, field: keyof RecipeIngredient, value: string) => {
    setIngredients(ingredients.map(ing => (ing.id === id ? { ...ing, [field]: value } : ing)));
    setFormChanged(true);
  };

  const removeIngredient = (id: string) => {
    if (ingredients.length > 1) {
      setIngredients(ingredients.filter(ing => ing.id !== id));
      setFormChanged(true);
    }
  };

  const addStep = () => {
    setSteps([...steps, { id: `step-${Date.now()}`, content: '' }]);
    setFormChanged(true);
  };

  const updateStep = (id: string, content: string) => {
    setSteps(steps.map(step => (step.id === id ? { ...step, content } : step)));
    setFormChanged(true);
  };

  const updateStepImage = (id: string, imageUrl: string) => {
    setSteps(steps.map(step => (step.id === id ? { ...step, imageUrl } : step)));
    setFormChanged(true);
  };

  const removeStep = (id: string) => {
    if (steps.length > 1) {
      setSteps(steps.filter(step => step.id !== id));
      setFormChanged(true);
    }
  };

  const updateNutrition = (field: keyof RecipeNutrition, value: string) => {
    setNutrition({ ...nutrition, [field]: parseFloat(value) || 0 });
    setFormChanged(true);
  };

  const addTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()]);
      setTagInput('');
      setFormChanged(true);
    }
  };

  const removeTag = (tag: string) => {
    setTags(tags.filter(t => t !== tag));
    setFormChanged(true);
  };

  const addRelatedProduct = () => {
    if (productInput.trim() && !relatedProducts.includes(productInput.trim())) {
      setRelatedProducts([...relatedProducts, productInput.trim()]);
      setProductInput('');
      setFormChanged(true);
    }
  };

  const removeRelatedProduct = (product: string) => {
    setRelatedProducts(relatedProducts.filter(p => p !== product));
    setFormChanged(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) { alert('Vui lòng nhập tiêu đề công thức'); return; }

    try {
      await createMutation.mutateAsync({
        title,
        description,
        preparationTime: prepTime ? Number(prepTime) : undefined,
        cookingTime: cookTime ? Number(cookTime) : undefined,
        servings: servings ? Number(servings) : undefined,
        difficulty: difficulty as 'easy' | 'medium' | 'hard',
        mealType: (category || 'other') as any,
        videoDemonstration: videoUrl || undefined,
        coverImage: thumbnailUrl || undefined,
        isFeatured: featured,
        ingredients: ingredients
          .filter(i => i.name.trim() && i.quantity.trim() && i.unit.trim())
          .map(i => ({ name: i.name, quantity: i.quantity, unit: i.unit, notes: i.notes })),
        instructions: steps.filter(s => s.content.trim()).map((s, idx) => ({
          step: idx + 1, description: s.content, image: s.imageUrl,
        })),
        nutritionInfo: {
          calories: nutrition.calories,
          protein: nutrition.protein,
          carbohydrates: nutrition.carbs,
          fat: nutrition.fat,
          fiber: nutrition.fiber,
        },
        tags,
        isPublished: true,
      });
      setFormChanged(false);
      navigate('/recipes');
    } catch (err: any) {
      alert(err?.response?.data?.message ?? 'Không thể tạo công thức');
    }
  };

  const handleDiscard = () => {
    if (formChanged && !window.confirm('Bạn có chắc chắn muốn hủy? Tất cả các thay đổi sẽ bị mất.')) return;
    window.history.back();
  };

  const tabs = [
    { key: 'basic', label: 'Thông tin cơ bản' },
    { key: 'ingredients', label: 'Nguyên liệu' },
    { key: 'steps', label: 'Các bước thực hiện' },
    { key: 'nutrition', label: 'Dinh dưỡng & Gợi ý' },
  ] as const;

  const tabKeys = tabs.map(t => t.key);
  const currentIndex = tabKeys.indexOf(activeTab);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center">
            <button onClick={handleDiscard} className="mr-4 p-2 text-gray-500 hover:text-gray-700">
              <ArrowLeft size={20} />
            </button>
            <h1 className="text-2xl font-bold text-gray-800 flex items-center">
              <Book className="mr-2" size={24} />
              Thêm công thức nấu ăn mới
            </h1>
          </div>
          <p className="mt-1 text-gray-500">Tạo công thức nấu ăn mới để giới thiệu đến khách hàng</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleDiscard}
            className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Hủy
          </button>
          <button
            onClick={handleSubmit}
            className="px-4 py-2 bg-indigo-600 border border-transparent rounded-md shadow-sm text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            <Save className="w-4 h-4 inline mr-1" />
            Lưu công thức
          </button>
        </div>
      </div>

      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.key
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="bg-white shadow-sm rounded-lg">
        <form onSubmit={handleSubmit}>
          {activeTab === 'basic' && (
            <RecipeBasicForm
              title={title}
              description={description}
              category={category}
              prepTime={prepTime}
              cookTime={cookTime}
              servings={servings}
              difficulty={difficulty}
              thumbnailUrl={thumbnailUrl}
              videoUrl={videoUrl}
              featured={featured}
              onChange={handleBasicChange}
            />
          )}

          {activeTab === 'ingredients' && (
            <RecipeIngredientForm
              ingredients={ingredients}
              onAdd={addIngredient}
              onUpdate={updateIngredient}
              onRemove={removeIngredient}
            />
          )}

          {activeTab === 'steps' && (
            <RecipeStepsForm
              steps={steps}
              onAdd={addStep}
              onUpdate={updateStep}
              onUpdateImage={updateStepImage}
              onRemove={removeStep}
            />
          )}

          {activeTab === 'nutrition' && (
            <RecipeNutritionForm
              nutrition={nutrition}
              tags={tags}
              tagInput={tagInput}
              relatedProducts={relatedProducts}
              productInput={productInput}
              onNutritionChange={updateNutrition}
              onTagInputChange={setTagInput}
              onAddTag={addTag}
              onRemoveTag={removeTag}
              onProductInputChange={setProductInput}
              onAddProduct={addRelatedProduct}
              onRemoveProduct={removeRelatedProduct}
            />
          )}

          <div className="px-6 py-4 bg-gray-50 flex justify-end">
            <button
              type="button"
              onClick={handleDiscard}
              className="mr-3 px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 border border-transparent rounded-md shadow-sm text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              <Save className="w-4 h-4 inline mr-1" />
              Lưu công thức
            </button>
          </div>
        </form>
      </div>

      <div className="flex justify-between">
        <button
          type="button"
          onClick={() => currentIndex > 0 && setActiveTab(tabKeys[currentIndex - 1])}
          disabled={currentIndex === 0}
          className={`px-4 py-2 text-sm font-medium rounded-md ${
            currentIndex === 0 ? 'text-gray-400 cursor-not-allowed' : 'text-indigo-700 bg-indigo-100 hover:bg-indigo-200'
          }`}
        >
          <ArrowLeft className="inline mr-1 h-4 w-4" />
          Quay lại
        </button>
        <button
          type="button"
          onClick={() => currentIndex < tabKeys.length - 1 && setActiveTab(tabKeys[currentIndex + 1])}
          disabled={currentIndex === tabKeys.length - 1}
          className={`px-4 py-2 text-sm font-medium rounded-md ${
            currentIndex === tabKeys.length - 1 ? 'text-gray-400 cursor-not-allowed' : 'text-indigo-700 bg-indigo-100 hover:bg-indigo-200'
          }`}
        >
          Tiếp theo
          <ArrowLeft className="inline ml-1 h-4 w-4 transform rotate-180" />
        </button>
      </div>
    </div>
  );
};

export default AddRecipe;
