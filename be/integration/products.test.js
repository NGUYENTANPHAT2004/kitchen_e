const Product = require('../models/Product');
const productRouter = require('../routes/api/products.routes');

describe('Product route and model smoke checks', () => {
  test('declares stockQuantity used by checkout inventory reservation', () => {
    expect(Product.schema.path('stockQuantity')).toBeDefined();
  });

  test('registers public literal routes before /:id', () => {
    const routes = productRouter.stack
      .filter((layer) => layer.route)
      .map((layer) => `${Object.keys(layer.route.methods)[0].toUpperCase()} ${layer.route.path}`);

    expect(routes.indexOf('GET /search')).toBeLessThan(routes.indexOf('GET /:id'));
    expect(routes.indexOf('GET /featured')).toBeLessThan(routes.indexOf('GET /:id'));
    expect(routes.indexOf('GET /best-selling')).toBeLessThan(routes.indexOf('GET /:id'));
  });
});
