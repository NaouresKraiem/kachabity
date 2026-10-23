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
import { CampaignsController } from './crm/campaigns.controller';
import {
  CustomersController,
  InteractionsController,
  TasksController,
} from './crm/crm.controllers';
import { MetaWebhookController } from './crm/meta-webhook.controller';
import {
  AccountingController,
  AccountsController,
  BankController,
  BillsController,
  InvoicesController,
  ReportsController,
  TreasuryController,
} from './finance/finance.controllers';
import { PosController } from './pos/pos.controller';
import {
  CostingController,
  MaterialsController,
  PurchaseOrdersController,
  PurchasePricesController,
  ReceiptsController,
} from './purchasing/purchasing.controllers';
import { DeliveryController } from './sales/delivery.controller';
import { OrdersController } from './sales/orders.controller';
import {
  PaymentsController,
  RemittancesController,
  SalesOrdersController,
} from './sales/sales.controllers';
import {
  CollectionsController,
  LocationsController,
  StockCostsController,
  StockMovementsController,
  StockReportsController,
  StockTrackingController,
  SuppliersController,
} from './stock/stock.controllers';

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
    SuppliersController,
    CollectionsController,
    LocationsController,
    StockTrackingController,
    StockCostsController,
    StockMovementsController,
    StockReportsController,
    OrdersController,
    SalesOrdersController,
    PaymentsController,
    RemittancesController,
    DeliveryController,
    CustomersController,
    InteractionsController,
    TasksController,
    MetaWebhookController,
    CampaignsController,
    PosController,
    PurchaseOrdersController,
    ReceiptsController,
    MaterialsController,
    CostingController,
    PurchasePricesController,
    AccountingController,
    AccountsController,
    BankController,
    BillsController,
    InvoicesController,
    ReportsController,
    TreasuryController,
  ],
  providers: [
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_INTERCEPTOR, useClass: ApiResponseInterceptor },
    { provide: APP_FILTER, useClass: ApiExceptionFilter },
  ],
})
export class AppModule {}
