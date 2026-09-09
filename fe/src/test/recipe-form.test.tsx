// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import RecipeBasicForm from "../features/recipes/components/RecipeBasicForm";

afterEach(cleanup);
it("recipe categories match backend meal types and load the other category", () => {
  render(
    <RecipeBasicForm
      title="Recipe"
      description="Description"
      category="other"
      prepTime="1"
      cookTime="0"
      servings="1"
      difficulty="easy"
      thumbnailUrl=""
      videoUrl=""
      featured={false}
      onChange={vi.fn()}
    />
  );
  const field = screen.getByLabelText(/Danh mục/) as HTMLSelectElement;
  expect(field.value).toBe("other");
  expect(
    [...field.options]
      .map((option) => option.value)
      .filter(Boolean)
      .sort()
  ).toEqual([
    "appetizer",
    "breakfast",
    "dessert",
    "dinner",
    "drink",
    "lunch",
    "other",
    "snack",
  ]);
  expect(screen.getByLabelText(/Thời gian chuẩn bị/).getAttribute("min")).toBe(
    "1"
  );
});
