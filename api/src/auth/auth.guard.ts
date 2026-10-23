import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import {
  createLocalJWKSet,
  createRemoteJWKSet,
  jwtVerify,
  type JSONWebKeySet,
  type JWTPayload,
} from 'jose';
import {
  allows,
  getAdminRole,
  getPermissions,
  type AdminRole,
  type Permission,
  type Requirement,
} from '@shared/admin-auth';
import { config } from '../config';
import { Database } from '../db/database';
import { PUBLIC, REQUIREMENT } from './decorators';

export interface RequestActor {
  userId: string;
  email: string | null;
  role: AdminRole;
  permissions: Permission[];
}

// SUPABASE_JWKS saves fetching the keys on boot; without it they are fetched and cached by jose.
const jwks = config.SUPABASE_JWKS
  ? createLocalJWKSet(JSON.parse(config.SUPABASE_JWKS) as JSONWebKeySet)
  : createRemoteJWKSet(
      new URL('/auth/v1/.well-known/jwks.json', config.SUPABASE_URL),
    );

/** The Supabase access token: `Authorization: Bearer`, or the admin's session cookie (possibly split in .0/.1 chunks). */
export function accessToken(request: Pick<Request, 'headers'>): string | null {
  const bearer = request.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
  if (bearer) return bearer;

  const chunks = (request.headers.cookie ?? '')
    .split(';')
    .map((part) => part.trim().split('='))
    .map(([name, ...value]) => ({
      name,
      value: decodeURIComponent(value.join('=')),
      match: name?.match(/^sb-.+-auth-token(?:\.(\d+))?$/),
    }))
    .filter((c) => c.match)
    .sort((a, b) => Number(a.match![1] ?? 0) - Number(b.match![1] ?? 0));
  if (chunks.length === 0) return null;

  let raw = chunks.map((c) => c.value).join('');
  if (raw.startsWith('base64-'))
    raw = Buffer.from(raw.slice('base64-'.length), 'base64url').toString(
      'utf8',
    );
  try {
    const session = JSON.parse(raw) as { access_token?: unknown } | null;
    return typeof session?.access_token === 'string'
      ? session.access_token
      : null;
  } catch {
    return null;
  }
}

/** Port of the back-office gate in middleware.ts: every route is refused unless a decorator opens it. */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly db: Database,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<Request & { actor?: RequestActor | null }>();
    const targets = [context.getHandler(), context.getClass()];
    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC, targets);
    const requirement = this.reflector.getAllAndOverride<Requirement>(
      REQUIREMENT,
      targets,
    );

    const claims = await this.verify(request);
    request.actor = claims ? this.actorFrom(claims) : null;

    if (isPublic) return true;
    if (!requirement)
      throw new ForbiddenException('This route has no access rule');
    if (!claims) throw new UnauthorizedException('Sign in again');
    const actor = request.actor;
    if (!actor) throw new ForbiddenException('Forbidden');
    if (!allows(requirement, actor.role, actor.permissions)) {
      await this.logRefusal(request, actor);
      throw new ForbiddenException('Forbidden');
    }
    return true;
  }

  private async verify(request: Request): Promise<JWTPayload | null> {
    const token = accessToken(request);
    if (!token) return null;
    try {
      return (await jwtVerify(token, jwks)).payload;
    } catch {
      return null;
    }
  }

  private actorFrom(claims: JWTPayload): RequestActor | null {
    const user = {
      email: typeof claims.email === 'string' ? claims.email : null,
      app_metadata: (claims.app_metadata ?? {}) as Record<string, unknown>,
    };
    const role = getAdminRole(user);
    if (!role || typeof claims.sub !== 'string') return null;
    return {
      userId: claims.sub,
      email: user.email,
      role,
      permissions: getPermissions(user),
    };
  }

  // Recorded in the activity log, which alerts the owner (private.owner_alerts). Never fails the request.
  private async logRefusal(request: Request, actor: RequestActor) {
    if (
      request.headers['next-router-prefetch'] ||
      request.headers.purpose === 'prefetch'
    )
      return;
    const [path, query] = request.originalUrl.split('?');
    await this.db
      .insertInto('activity_log')
      .values({
        actor_id: actor.userId,
        actor_email: actor.email,
        actor_role: actor.role,
        action: 'access_denied',
        entity: 'access',
        label: `${request.method} ${path}`,
        changes: JSON.stringify({ query: query ? `?${query}` : null }),
      })
      .execute()
      .catch(() => undefined);
  }
}
