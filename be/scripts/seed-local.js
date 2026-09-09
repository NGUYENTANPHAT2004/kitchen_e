const mongoose = require("mongoose");
const User = require("../models/User");
const Category = require("../models/Category");
const Product = require("../models/Product");
const Variant = require("../models/ProductVariant");
const Recipe = require("../models/Recipe");
const Voucher = require("../models/Voucher");
const StoreSettings = require("../models/StoreSettings");

async function seed() {
  // Fixed local target: this script never replaces or deletes existing data.
  await mongoose.connect(
    "mongodb://127.0.0.1:27018/kitchen_e_local?replicaSet=kitchenLocal"
  );
  for (const role of ["admin", "customer"]) {
    if (!(await User.findOne({ email: `${role}@kitchen.local` }))) {
      await User.create({
        email: `${role}@kitchen.local`,
        username: `kitchen_${role}`,
        firstName: role === "admin" ? "Quản trị" : "Khách hàng",
        lastName: "Kitchen E",
        password: "KitchenLocal2026!",
        role,
        isEmailVerified: true,
      });
    }
  }
  const groups = [
    ["Nồi & chảo", "noi-chao", "carbon-steel-wok"],
    ["Dụng cụ bếp", "dung-cu-bep", "chopping-board"],
    ["Thiết bị điện", "thiet-bi-dien", "boxed-blender"],
    ["Bàn ăn", "ban-an", "glass"],
  ];
  const categories = [];
  for (const [index, [name, slug, image]] of groups.entries()) {
    let category = await Category.findOne({ name });
    if (!category)
      category = await Category.create({
        name,
        slug,
        image: `/images/${image}.webp`,
        displayOrder: index,
        featured: true,
        showInHome: true,
        showInMenu: true,
      });
    categories.push(category);
  }
  const catalog = [
    ["Chảo thép carbon sâu lòng", 459000, 0, "carbon-steel-wok"],
    ["Thớt gỗ chữ nhật", 189000, 1, "chopping-board"],
    ["Máy xay sinh tố để bàn", 899000, 2, "boxed-blender"],
    ["Phới đánh trứng", 89000, 1, "black-whisk"],
    ["Xẻng nấu ăn bằng tre", 69000, 1, "bamboo-spatula"],
    ["Máy xay cầm tay", 649000, 2, "hand-blender"],
    ["Bếp điện đơn", 1290000, 2, "electric-stove"],
    ["Dao bếp đa năng", 259000, 1, "knife"],
    ["Rây lọc lưới mịn", 119000, 1, "fine-mesh-strainer"],
    ["Ly thủy tinh", 59000, 3, "glass"],
    ["Lò vi sóng gia đình", 1890000, 2, "microwave-oven"],
    ["Cốc nhôm đen", 99000, 3, "black-aluminium-cup"],
  ];
  for (const [index, [name, price, category, image]] of catalog.entries()) {
    const sku = `KE-LOCAL-${index + 1}`;
    if (!(await Product.findOne({ sku })))
      await Product.create({
        name,
        sku,
        description: `${name}, thiết kế gọn gàng cho căn bếp mỗi ngày. Dễ sử dụng và vệ sinh sau khi nấu.`,
        categoryId: categories[category]._id,
        basePrice: price,
        stockQuantity: 30,
        featured: index < 8,
        tags: ["local-demo"],
        images: [
          { url: `/images/${image}.webp`, altText: name, isDefault: true },
        ],
      });
  }
  const wok = await Product.findOne({ sku: "KE-LOCAL-1" });
  for (const [size, stockQuantity, priceAdjustment] of [
    ["28 cm", 20, 0],
    ["32 cm", 15, 80000],
  ]) {
    const sku = `KE-LOCAL-WOK-${size.slice(0, 2)}`;
    if (!(await Variant.findOne({ sku })))
      await Variant.create({
        sku,
        productId: wok._id,
        name: size,
        size,
        stockQuantity,
        priceAdjustment,
      });
  }
  const title = "Rau củ xào cho bữa cơm nhà";
  if (!(await Recipe.findOne({ title })))
    await Recipe.create({
      title,
      description:
        "Bữa cơm giản dị với rau củ theo mùa, giữ trọn màu sắc và độ giòn.",
      coverImage: "/images/kitchen.jpg",
      preparationTime: 10,
      cookingTime: 10,
      servings: 2,
      difficulty: "easy",
      isPublished: true,
      isFeatured: true,
      authorName: "Kitchen E",
      ingredients: [
        { name: "Rau củ theo mùa", quantity: "400", unit: "g" },
        { name: "Dầu ăn", quantity: "1", unit: "muỗng" },
      ],
      instructions: [
        { step: 1, description: "Rửa sạch, để ráo và cắt rau củ vừa ăn." },
        {
          step: 2,
          description:
            "Làm nóng dầu, xào rau củ đến chín, nêm vừa ăn và dùng nóng.",
        },
      ],
    });
  if (!(await Voucher.findOne({ code: "KITCHEN10" })))
    await Voucher.create({
      code: "KITCHEN10",
      description: "Ưu đãi 10% cho đơn từ 100.000 đồng",
      discountType: "percentage",
      discountValue: 10,
      minOrderValue: 100000,
      maxUsage: 100,
      startDate: new Date("2026-01-01"),
      endDate: new Date("2027-12-31T23:59:59Z"),
    });
  if (!(await StoreSettings.findOne()))
    await StoreSettings.create({ contactEmail: "support@example.com" });
  console.log(
    "Local catalog ready: 12 products, 4 categories, 2 accounts. Password: KitchenLocal2026!"
  );
}
seed()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
