import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { config } from '../config';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';

const s3Client = new S3Client({
  region: config.AWS_REGION,
  ...(config.AWS_ACCESS_KEY_ID && config.AWS_SECRET_ACCESS_KEY
    ? {
        credentials: {
          accessKeyId: config.AWS_ACCESS_KEY_ID,
          secretAccessKey: config.AWS_SECRET_ACCESS_KEY,
        },
      }
    : {}),
});

export interface UploadResult {
  key: string;
  url: string;
}

/**
 * Upload a file buffer to S3
 */
export async function uploadToS3(
  buffer: Buffer,
  originalFilename: string,
  mimeType: string,
  folder: string = 'uploads'
): Promise<UploadResult> {
  if (!config.AWS_S3_BUCKET) {
    throw new Error('AWS_S3_BUCKET is not configured');
  }

  const ext = path.extname(originalFilename);
  const key = `${folder}/${uuidv4()}${ext}`;

  const command = new PutObjectCommand({
    Bucket: config.AWS_S3_BUCKET,
    Key: key,
    Body: buffer,
    ContentType: mimeType,
    ServerSideEncryption: 'AES256',
    Metadata: {
      originalFilename,
    },
  });

  await s3Client.send(command);
  logger.info(`Uploaded file to S3: ${key}`);

  const url = `${config.AWS_S3_PUBLIC_URL}/${key}`;
  return { key, url };
}

/**
 * Delete a file from S3
 */
export async function deleteFromS3(key: string): Promise<void> {
  if (!config.AWS_S3_BUCKET) return;

  const command = new DeleteObjectCommand({
    Bucket: config.AWS_S3_BUCKET,
    Key: key,
  });

  await s3Client.send(command);
  logger.info(`Deleted file from S3: ${key}`);
}

/**
 * Generate a pre-signed URL for private file access (expires in 1 hour)
 */
export async function getPresignedUrl(key: string, expiresIn = 3600): Promise<string> {
  if (!config.AWS_S3_BUCKET) throw new Error('S3 not configured');

  const command = new GetObjectCommand({
    Bucket: config.AWS_S3_BUCKET,
    Key: key,
  });

  return getSignedUrl(s3Client, command, { expiresIn });
}

/**
 * Extract S3 key from a public URL
 */
export function extractKeyFromUrl(url: string): string {
  const publicBase = config.AWS_S3_PUBLIC_URL || '';
  return url.replace(`${publicBase}/`, '');
}
