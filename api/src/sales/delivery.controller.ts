import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Post,
  Query,
} from '@nestjs/common';
import * as Sentry from '@sentry/nestjs';
import { jsonArrayFrom, jsonObjectFrom } from 'kysely/helpers/postgres';
import { z } from 'zod';
import {
  ColissimoError,
  colissimoConfigured,
  createParcel,
  trackParcel,
  type ParcelRequest,
} from '@shared/colissimo';
import {
  COLISSIMO_GOVERNORATES,
  FINAL_STATUSES,
  parcelFromOrder,
} from '@shared/colissimo-data';
import { MANUAL_CHANNELS, type Channel } from '@shared/erp/constants';
import { generateOrderNumber } from '@shared/order-number';
import { CurrentActor, Public } from '../auth/decorators';
import type { RequestActor } from '../auth/auth.guard';
import { ApiError, idsFrom } from '../common/api';
import { invalidateCatalog } from '../catalog/revalidate';
import { Database } from '../db/database';
import {
  buildManualOrderLines,
  ManualLineError,
  type ManualLineInput,
} from './commerce';

// Port of app/api/delivery/route.ts: parcels sent to Colissimo (Admin → Delivery, the order page).
// GET lists them; POST sends, validates, quotes, tracks, imports or refreshes; DELETE removes from the list.

const parcelSchema = z.object({
  nom: z.string().trim().min(1).max(100),
  gouvernerat: z.enum(COLISSIMO_GOVERNORATES as [string, ...string[]]),
  ville: z.string().trim().min(1).max(100),
  adresse: z.string().trim().min(1).max(250),
  tel: z
    .string()
    .trim()
    .regex(/^\d{8}$/, 'Phone must be exactly 8 digits'),
  tel2: z
    .string()
    .trim()
    .regex(/^(\d{8})?$/, 'Second phone must be 8 digits')
    .optional(),
  designation: z.string().trim().min(1).max(250),
  nb_article: z.number().int().min(1).max(999),
  prix: z.number().min(0).max(100000),
  msg: z.string().trim().max(250).optional(),
  echange: z.enum(['oui', 'non']),
  article: z.string().trim().max(250).optional(),
  nb_echange: z.number().int().min(0).max(999).optional(),
  ouvrir: z.union([z.literal(0), z.literal(1)]),
  fragile: z.union([z.literal(0), z.literal(1)]),
  type_colis: z.union([z.literal(1), z.literal(2), z.literal(3)]),
});
const itemsSchema = z.array(
  z.object({
    product_id: z.guid(),
    variant_id: z.guid().nullish(),
    quantity: z.number().int().min(1).max(999),
  }),
);
const barcode = z
  .string()
  .trim()
  .regex(/^\d{6,20}$/, 'Barcode must be digits');
const bodySchema = z.discriminatedUnion('action', [
  // A parcel for an order, or entered by hand; with `items` (no order_id) an order is created and validated.
  z.object({
    action: z.literal('create'),
    order_id: z.guid().optional(),
    parcel: parcelSchema,
    items: itemsSchema.max(50).optional(),
    channel: z.enum(MANUAL_CHANNELS as [Channel, ...Channel[]]).optional(),
    campaign_id: z.guid().nullish(),
  }),
  // Validating an order: its parcel is built from the order and sent, then the order is validated.
  z.object({ action: z.literal('validate'), order_id: z.guid() }),
  // Prices for products picked in "New parcel", without saving.
  z.object({ action: z.literal('quote'), items: itemsSchema.min(1).max(50) }),
  // One parcel's status at Colissimo, without saving.
  z.object({ action: z.literal('track'), barcode }),
  z.object({
    action: z.literal('import'),
    barcode,
    order_id: z.guid().optional(),
  }),
  z.object({
    action: z.literal('refresh'),
    ids: z.array(z.guid()).max(200).optional(),
  }),
]);

const notConfigured = (what: 'add' | 'tracking') =>
  new ApiError(
    what === 'add'
      ? 'Colissimo is not set up: add COLISSIMO_ADD_TOKEN to the server environment'
      : 'Colissimo tracking is not set up: add COLISSIMO_TRACKING_TOKEN to the server environment',
    503,
    'NOT_CONFIGURED',
  );

function dbError(error: any): never {
  const message: string = error?.message ?? '';
  if (message.includes('order_not_found'))
    throw new ApiError('Order not found', 404);
  if (message.includes('order_cancelled'))
    throw new ApiError('This order is cancelled', 409, 'ORDER_CANCELLED');
  if (message.includes('delivery_exists') || error?.code === '23505') {
    throw new ApiError(
      'This order or barcode already has a parcel',
      409,
      'DELIVERY_EXISTS',
    );
  }
  throw error;
}

@Controller('delivery')
@Public()
export class DeliveryController {
  constructor(private readonly db: Database) {}

  private select() {
    return this.db
      .selectFrom('deliveries as d')
      .selectAll('d')
      .select((eb) =>
        jsonObjectFrom(
          eb
            .selectFrom('orders as o')
            .select([
              'o.id',
              'o.order_number',
              'o.customer_first_name',
              'o.customer_last_name',
              'o.status',
              'o.total',
            ])
            .whereRef('o.id', '=', 'd.order_id'),
        ).as('order'),
      )
      .where('d.deleted_at', 'is', null);
  }

  @Get()
  async list(@Query('order_id') orderId?: string) {
    let query = this.select().orderBy('d.created_at', 'desc').limit(1000);
    if (orderId) query = query.where('d.order_id', '=', orderId);
    return { rows: await query.execute(), configured: colissimoConfigured() };
  }

  @Post()
  @HttpCode(200)
  async post(@Body() raw: unknown, @CurrentActor() actor: RequestActor) {
    const parsed = bodySchema.safeParse(raw ?? null);
    if (!parsed.success)
      throw new ApiError(parsed.error.issues[0]?.message ?? 'Invalid request');
    const body = parsed.data;
    try {
      if (body.action === 'create') {
        if (!body.order_id && body.items?.length) {
          return await this.sendNewOrder(
            body.parcel,
            body.items,
            actor,
            body.channel ?? 'phone',
            body.campaign_id ?? null,
          );
        }
        return await this.sendParcel(body.order_id ?? null, body.parcel, actor);
      }
      if (body.action === 'validate')
        return await this.validateOrder(body.order_id, actor);
      if (body.action === 'quote')
        return { lines: await buildManualOrderLines(this.db, body.items) };
      if (body.action === 'track') return await this.lookUp(body.barcode);
      if (body.action === 'import')
        return await this.importParcel(
          body.barcode,
          body.order_id ?? null,
          actor,
        );
      return await this.refresh(body.ids, actor);
    } catch (error) {
      if (error instanceof ManualLineError)
        throw new ApiError(error.message, 422, 'INVALID_ITEMS');
      if (error instanceof ColissimoError)
        throw new ApiError(error.message, 502, 'COLISSIMO');
      throw error;
    }
  }

  /** ?ids=a,b — removes parcels from this list only (soft delete); the order can then be sent again. */
  @Delete()
  async remove(
    @Query() query: { ids?: string },
    @CurrentActor() actor: RequestActor,
  ) {
    const ids = idsFrom({ ids: query.ids });
    if (ids.length === 0) throw new ApiError('No parcel selected');
    await this.db.withActor(actor, (trx) =>
      trx
        .updateTable('deliveries')
        .set({ deleted_at: new Date(), updated_at: new Date() })
        .where('id', 'in', ids)
        .where('deleted_at', 'is', null)
        .execute(),
    );
    return { deleted: ids.length };
  }

  // Reserve the parcel row (for an order: its single live parcel), create the parcel at Colissimo,
  // then record its barcode and validate the order. If Colissimo refuses, the row is released.
  private async sendParcel(
    orderId: string | null,
    parcel: ParcelRequest,
    actor: RequestActor,
  ) {
    if (!colissimoConfigured().add) throw notConfigured('add');
    const reserved = await this.db
      .withActor(actor, (trx) =>
        orderId
          ? this.db.call<{ id: string }>(
              'begin_delivery',
              {
                p_order_id: orderId,
                p_request: parcel,
                p_actor: actor.userId,
                p_actor_email: actor.email,
              },
              trx,
            )
          : trx
              .insertInto('deliveries')
              .values({
                status: 'sending',
                recipient_name: parcel.nom,
                phone: parcel.tel,
                governorate: parcel.gouvernerat,
                city: parcel.ville,
                address: parcel.adresse,
                cod_amount: parcel.prix,
                items_count: parcel.nb_article,
                designation: parcel.designation,
                request: JSON.stringify(parcel),
                created_by: actor.userId,
                created_by_email: actor.email,
              })
              .returning('id')
              .executeTakeFirstOrThrow(),
      )
      .catch(dbError);

    let created: Awaited<ReturnType<typeof createParcel>>;
    try {
      created = await createParcel(parcel);
    } catch (error) {
      await this.db.withActor(actor, (trx) =>
        this.db.call(
          'fail_delivery',
          { p_id: reserved.id, p_error: (error as Error).message },
          trx,
        ),
      );
      throw error;
    }

    try {
      const result = await this.db.withActor(actor, (trx) =>
        this.db.call<{
          delivery: unknown;
          order: unknown;
          warning: string | null;
        }>(
          'complete_delivery',
          {
            p_id: reserved.id,
            p_barcode: created.barcode,
            p_label_url: created.labelUrl,
            p_label_zebra_url: created.labelZebraUrl,
            p_actor: actor.userId,
            p_actor_email: actor.email,
          },
          trx,
        ),
      );
      await invalidateCatalog(); // validating the order took its items out of stock
      return {
        delivery: result.delivery,
        order: result.order,
        warning: result.warning,
      };
    } catch (error) {
      // The parcel exists at Colissimo: release the row and give the barcode back for "Add by barcode".
      Sentry.captureException(error, {
        tags: { area: 'admin-delivery', action: 'complete' },
      });
      await this.db.withActor(actor, (trx) =>
        this.db.call(
          'fail_delivery',
          {
            p_id: reserved.id,
            p_error: `Created as ${created.barcode}, not saved: ${(error as Error).message}`,
          },
          trx,
        ),
      );
      throw new ApiError(
        `Colissimo created parcel ${created.barcode}, but saving it failed. Add it with "Add by barcode".`,
        500,
        'SAVE_FAILED',
        {
          barcode: created.barcode,
        },
      );
    }
  }

  // "New parcel" with products: price the lines, create the parcel at Colissimo, then save the
  // order, lines and parcel and validate the order in one transaction (create_order_with_delivery).
  private async sendNewOrder(
    parcel: ParcelRequest,
    items: ManualLineInput[],
    actor: RequestActor,
    channel: Channel,
    campaignId: string | null,
  ) {
    if (!colissimoConfigured().add) throw notConfigured('add');
    const lines = await buildManualOrderLines(this.db, items); // create_order ignores the extra `stock` field
    const subtotal = lines.reduce((sum, line) => sum + line.subtotal, 0);
    const [firstName, ...rest] = parcel.nom.trim().split(/\s+/);

    const created = await createParcel(parcel);
    try {
      const result = await this.db.withActor(actor, (trx) =>
        this.db.call<{ delivery: unknown; order: unknown }>(
          'create_order_with_delivery',
          {
            p_order: {
              order_number: generateOrderNumber(),
              customer_first_name: firstName,
              customer_last_name: rest.join(' '),
              customer_phone: parcel.tel,
              shipping_address: parcel.adresse,
              shipping_city: parcel.ville,
              shipping_state: parcel.gouvernerat,
              shipping_country: 'Tunisia',
              // The cash to collect is what the customer pays; above the products, it's the delivery fee.
              subtotal,
              shipping_cost: Math.max(0, parcel.prix - subtotal),
              total: parcel.prix,
              order_notes: parcel.msg || null,
              channel,
              campaign_id: campaignId,
              assigned_to: actor.userId,
              assigned_to_email: actor.email,
            },
            p_items: lines,
            p_delivery: {
              barcode: created.barcode,
              label_url: created.labelUrl,
              label_zebra_url: created.labelZebraUrl,
              request: parcel,
            },
            p_actor: actor.userId,
            p_actor_email: actor.email,
          },
          trx,
        ),
      );
      await invalidateCatalog(); // the products left the stock
      return { delivery: result.delivery, order: result.order, warning: null };
    } catch (error) {
      Sentry.captureException(error, {
        tags: { area: 'admin-delivery', action: 'create-order' },
      });
      throw new ApiError(
        `Colissimo created parcel ${created.barcode}, but saving the order failed. Add it with "Add by barcode".`,
        500,
        'SAVE_FAILED',
        {
          barcode: created.barcode,
        },
      );
    }
  }

  // The Validate button: send the order's parcel from its details, then validate it. Missing
  // details → NEEDS_DETAILS (completed in the send form). Without Colissimo, validate without a parcel.
  private async validateOrder(orderId: string, actor: RequestActor) {
    const order = await this.db
      .selectFrom('orders as o')
      .select([
        'o.id',
        'o.status',
        'o.customer_first_name',
        'o.customer_last_name',
        'o.customer_phone',
        'o.shipping_address',
        'o.shipping_city',
        'o.shipping_state',
        'o.total',
        'o.payment_status',
        'o.order_notes',
      ])
      .select((eb) =>
        jsonArrayFrom(
          eb
            .selectFrom('order_items as i')
            .select(['i.product_name', 'i.variant_label', 'i.quantity'])
            .whereRef('i.order_id', '=', 'o.id'),
        ).as('items'),
      )
      .where('o.id', '=', orderId)
      .where('o.deleted_at', 'is', null)
      .executeTakeFirst();
    if (!order) throw new ApiError('Order not found', 404);
    if (order.status !== 'pending' && order.status !== 'confirmed') {
      throw new ApiError(
        'This order is already validated',
        409,
        'ALREADY_VALIDATED',
      );
    }

    if (!colissimoConfigured().add) {
      const updated = await this.db.withActor(actor, (trx) =>
        this.db.call<{ status: string; stock_deducted: boolean }>(
          'set_order_status',
          {
            p_order_id: orderId,
            p_changes: { status: 'processing' },
            p_actor: actor.userId,
            p_actor_email: actor.email,
          },
          trx,
        ),
      );
      await invalidateCatalog();
      return {
        delivery: null,
        order: {
          status: updated.status,
          stock_deducted: updated.stock_deducted,
        },
        warning:
          'Colissimo is not connected: the order was validated without a parcel.',
      };
    }

    const parcel = parcelSchema.safeParse(parcelFromOrder(order));
    if (!parcel.success) {
      const fields = [
        ...new Set(parcel.error.issues.map((issue) => String(issue.path[0]))),
      ];
      throw new ApiError(
        `Delivery details to complete before sending: ${fields.join(', ')}`,
        422,
        'NEEDS_DETAILS',
        { fields },
      );
    }
    return this.sendParcel(orderId, parcel.data, actor);
  }

  // "Check a parcel": Colissimo's status for any barcode, plus our parcel if listed. Read-only.
  private async lookUp(code: string) {
    if (!colissimoConfigured().tracking) throw notConfigured('tracking');
    const [tracked, listed] = await Promise.all([
      trackParcel(code),
      this.select().where('d.barcode', '=', code).executeTakeFirst(),
    ]);
    return { barcode: code, ...tracked, delivery: listed ?? null };
  }

  // A parcel created on Colissimo's website: checked with the tracking API, then listed.
  private async importParcel(
    code: string,
    orderId: string | null,
    actor: RequestActor,
  ) {
    if (!colissimoConfigured().tracking) throw notConfigured('tracking');
    const tracked = await trackParcel(code);
    const { id } = await this.db
      .withActor(actor, (trx) =>
        trx
          .insertInto('deliveries')
          .values({
            barcode: code,
            order_id: orderId,
            status: tracked.status,
            status_reason: tracked.reason || null,
            status_changed_at: new Date(),
            created_by: actor.userId,
            created_by_email: actor.email,
          })
          .returning('id')
          .executeTakeFirstOrThrow(),
      )
      .catch(dbError);
    return {
      delivery: await this.select().where('d.id', '=', id).executeTakeFirst(),
    };
  }

  // Asks Colissimo for the status of the given parcels (default: every parcel that can still change).
  private async refresh(ids: string[] | undefined, actor: RequestActor) {
    if (!colissimoConfigured().tracking) throw notConfigured('tracking');
    let query = this.db
      .selectFrom('deliveries')
      .select(['id', 'barcode', 'status'])
      .where('deleted_at', 'is', null)
      .where('barcode', 'is not', null);
    query = ids?.length
      ? query.where('id', 'in', ids)
      : query.where('status', 'not in', FINAL_STATUSES);
    const parcels = await query.limit(200).execute();

    let changed = 0;
    const failures: { barcode: string; error: string }[] = [];
    // A few at a time: Colissimo answers one parcel per request.
    const queue = [...parcels];
    await Promise.all(
      Array.from({ length: Math.min(5, queue.length) }, async () => {
        for (let parcel = queue.shift(); parcel; parcel = queue.shift()) {
          try {
            const tracked = await trackParcel(parcel.barcode!);
            const updated = await this.db.withActor(actor, (trx) =>
              this.db.call(
                'record_delivery_status',
                {
                  p_id: parcel.id,
                  p_status: tracked.status,
                  p_reason: tracked.reason,
                  p_actor: actor.userId,
                  p_actor_email: actor.email,
                },
                trx,
              ),
            );
            if (updated) changed += 1;
          } catch (err) {
            failures.push({
              barcode: parcel.barcode!,
              error: (err as Error).message,
            });
          }
        }
      }),
    );
    if (changed > 0) await invalidateCatalog();
    return { checked: parcels.length, changed, failures };
  }
}
