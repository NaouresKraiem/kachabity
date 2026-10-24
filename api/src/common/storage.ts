import { AwsClient } from 'aws4fetch';
import { config } from '../config';
import { ApiError } from './api';

// Files in S3-compatible storage (Cloudflare R2 in production, MinIO locally), path-style URLs.
// Buckets: `products` (public: shop images, read at FILES_PUBLIC_URL) and `documents` (private:
// reached only through signed links).

export type Bucket = 'products' | 'documents';

const client =
  config.S3_ENDPOINT && config.S3_ACCESS_KEY_ID && config.S3_SECRET_ACCESS_KEY
    ? new AwsClient({
        accessKeyId: config.S3_ACCESS_KEY_ID,
        secretAccessKey: config.S3_SECRET_ACCESS_KEY,
        service: 's3',
        region: config.S3_REGION,
      })
    : null;

function objectUrl(bucket: Bucket, key: string) {
  if (!client) throw new ApiError('File storage is not configured.', 503);
  const path = key.split('/').map(encodeURIComponent).join('/');
  return `${config.S3_ENDPOINT}/${bucket}/${path}`;
}

async function send(url: string, init: RequestInit) {
  const response = await client!.fetch(url, init);
  if (!response.ok && response.status !== 404)
    throw new Error(
      `Storage ${init.method} failed: ${response.status} ${await response.text()}`,
    );
}

export const putObject = (
  bucket: Bucket,
  key: string,
  body: Buffer,
  contentType: string,
) =>
  send(objectUrl(bucket, key), {
    method: 'PUT',
    body: new Uint8Array(body),
    headers: {
      'Content-Type': contentType,
      'Cache-Control':
        bucket === 'products'
          ? 'public, max-age=31536000, immutable'
          : 'private',
    },
  });

export const deleteObject = (bucket: Bucket, key: string) =>
  send(objectUrl(bucket, key), { method: 'DELETE' });

/** A link that downloads a private file for `seconds`, under its original name. */
export async function signedUrl(
  bucket: Bucket,
  key: string,
  seconds: number,
  fileName?: string | null,
) {
  const url = new URL(objectUrl(bucket, key));
  url.searchParams.set('X-Amz-Expires', String(seconds));
  if (fileName)
    url.searchParams.set(
      'response-content-disposition',
      `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
    );
  const signed = await client!.sign(url.toString(), {
    method: 'GET',
    aws: { signQuery: true },
  });
  return signed.url;
}

/** Where the shop reads a public product file. */
export function publicUrl(key: string) {
  if (!config.FILES_PUBLIC_URL)
    throw new ApiError('File storage is not configured.', 503);
  return `${config.FILES_PUBLIC_URL}/${key}`;
}
