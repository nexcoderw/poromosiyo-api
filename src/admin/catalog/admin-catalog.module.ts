import {
  Module,
} from '@nestjs/common';

import {
  AuthModule,
} from '../../auth/auth.module';
import {
  DatabaseModule,
} from '../../database/database.module';
import {
  AdminBrandsController,
} from './controllers/admin-brands.controller';
import {
  AdminCategoriesController,
} from './controllers/admin-categories.controller';
import {
  AdminProductImagesController,
} from './controllers/admin-product-images.controller';
import {
  AdminProductsController,
} from './controllers/admin-products.controller';
import {
  AdminBrandsService,
} from './services/admin-brands.service';
import {
  AdminCategoriesService,
} from './services/admin-categories.service';
import {
  AdminProductArchiveService,
} from './services/admin-product-archive.service';
import {
  AdminProductImagesService,
} from './services/admin-product-images.service';
import {
  AdminProductPublicationService,
} from './services/admin-product-publication.service';
import {
  AdminProductsService,
} from './services/admin-products.service';

@Module({
  imports: [
    DatabaseModule,
    AuthModule,
  ],

  controllers: [
    AdminCategoriesController,
    AdminBrandsController,
    AdminProductsController,
    AdminProductImagesController,
  ],

  providers: [
    AdminCategoriesService,
    AdminBrandsService,
    AdminProductsService,
    AdminProductImagesService,
    AdminProductPublicationService,
    AdminProductArchiveService,
  ],
})
export class AdminCatalogModule {}
