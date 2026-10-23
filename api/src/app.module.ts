import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { AuthGuard } from './auth/auth.guard';
import { CategoriesController } from './catalog/categories.controller';
import {
  ProductDiscountsController,
  ReelsController,
  SaleBannersController,
} from './catalog/content.controllers';
import { LandingController } from './catalog/landing.controller';
import {
  ColorsController,
  SizesController,
} from './catalog/options.controller';
import { ProductImagesController } from './catalog/product-images.controller';
import { ProductsController } from './catalog/products.controller';
import { VariantsController } from './catalog/variants.controller';
import { ApiExceptionFilter, ApiResponseInterceptor } from './common/api';
import { DatabaseModule } from './db/database';
import { HealthController } from './health.controller';

@Module({
  imports: [DatabaseModule],
  controllers: [
    HealthController,
    CategoriesController,
    ProductsController,
    VariantsController,
    ProductImagesController,
    ColorsController,
    SizesController,
    ProductDiscountsController,
    SaleBannersController,
    ReelsController,
    LandingController,
  ],
  providers: [
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_INTERCEPTOR, useClass: ApiResponseInterceptor },
    { provide: APP_FILTER, useClass: ApiExceptionFilter },
  ],
})
export class AppModule {}
