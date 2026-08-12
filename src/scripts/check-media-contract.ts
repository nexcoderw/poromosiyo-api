import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();

const files = {
  storage: resolve(root, 'src/storage/image-storage.service.ts'),

  storageConstants: resolve(root, 'src/storage/image-storage.constants.ts'),

  app: resolve(root, 'src/app.module.ts'),

  categoriesDto: resolve(root, 'src/admin/catalog/dto/category.dto.ts'),

  brandsDto: resolve(root, 'src/admin/catalog/dto/brand.dto.ts'),

  categoriesController: resolve(
    root,
    'src/admin/catalog/controllers/admin-categories.controller.ts',
  ),

  brandsController: resolve(
    root,
    'src/admin/catalog/controllers/admin-brands.controller.ts',
  ),

  storesController: resolve(
    root,
    'src/admin/catalog/controllers/admin-stores.controller.ts',
  ),

  productImagesController: resolve(
    root,
    'src/admin/catalog/controllers/admin-product-images.controller.ts',
  ),

  productsService: resolve(
    root,
    'src/admin/catalog/services/admin-products.service.ts',
  ),
};

for (const [name, path] of Object.entries(files)) {
  assert(existsSync(path), `Missing ${name}: ${path}`);
}

const app = read(files.app);

assertIncludes(app, 'StorageModule', 'Storage module');

const storage = read(files.storage);

for (const expected of [
  "'categories'",
  "'brands'",
  "'stores'",
  "'products'",
  'GCS_IMAGE_PUBLIC_BASE_URL',
  'deleteManyQuietly',
]) {
  assertIncludes(storage, expected, 'ImageStorageService');
}

assertIncludes(
  read(files.storageConstants),
  'max-age=31536000',
  'image cache policy',
);

const categoryDto = read(files.categoriesDto);

assert(
  !categoryDto.includes('image?: string'),
  'Category DTO must not accept arbitrary image URLs.',
);

const brandDto = read(files.brandsDto);

assert(
  !brandDto.includes('logo?: string'),
  'Brand DTO must not accept arbitrary logo URLs.',
);

assertIncludes(
  read(files.categoriesController),
  "@Patch(':id/image')",
  'category image upload',
);

assertIncludes(
  read(files.categoriesController),
  "@Delete(':id/image')",
  'category image removal',
);

assertIncludes(
  read(files.brandsController),
  "@Patch(':id/logo')",
  'brand logo upload',
);

assertIncludes(
  read(files.brandsController),
  "@Delete(':id/logo')",
  'brand logo removal',
);

assertIncludes(
  read(files.storesController),
  "@Delete(':id/logo')",
  'store logo removal',
);

assertIncludes(
  read(files.productImagesController),
  'FileInterceptor',
  'product image multipart upload',
);

assertIncludes(
  read(files.productsService),
  'deleteManyQuietly',
  'product media cleanup',
);

console.log('Poromosiyo Milestone 20 media contract verification successful.');

function read(path: string): string {
  return readFileSync(path, 'utf8');
}

function assertIncludes(
  value: string,
  expected: string,
  description: string,
): void {
  assert(value.includes(expected), `${description} missing: ${expected}`);
}

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}
