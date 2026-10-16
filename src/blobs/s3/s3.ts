/**
 * S3 handler for blobs
 * @module blobs/s3/s3
 */

// Type imports
import type { S3ClientConfig } from '@aws-sdk/client-s3';
import type { Knex } from 'knex';

// External imports
import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';

// Internal imports
import config from '../../helpers/config/config';
import models from '../../models';

/**
 * Get the S3 client configuration. A custom endpoint and path-style
 * addressing support S3-compatible services (MinIO, R2, Ceph). Without
 * static keys the default AWS credential chain (environment, IAM role) is
 * used.
 * @method s3ClientConfig
 * @returns {S3ClientConfig} S3 client configuration
 */
export function s3ClientConfig(): S3ClientConfig {
  const { region, endpoint, forcePathStyle, accessKeyId, secretAccessKey } =
    config.settings.s3;
  return {
    region,
    ...(endpoint ? { endpoint } : {}),
    forcePathStyle: forcePathStyle || false,
    ...(accessKeyId && secretAccessKey
      ? { credentials: { accessKeyId, secretAccessKey } }
      : {}),
  };
}

let client: S3Client | undefined;

/**
 * Connect to S3
 * @method connectS3
 * @returns {S3Client} S3 client instance
 */
function connectS3() {
  if (!client) {
    client = new S3Client(s3ClientConfig());
  }
  return client;
}

export const s3 = {
  /**
   * Read
   * @method read
   * @param {string} uuid Uuid of the file to read.
   * @param {Knex.Transaction} _trx Transaction object.
   * @returns {Promise<Buffer>} File buffer.
   */
  read: async (uuid: string, _trx: Knex.Transaction) => {
    const s3 = connectS3();
    const command = new GetObjectCommand({
      Bucket: config.settings.s3.bucket,
      Key: uuid,
    });
    const response = await s3.send(command);
    return (await response?.Body?.transformToByteArray()) as Buffer;
  },

  /**
   * Store
   * @method store
   * @param {string} uuid Uuid of the file
   * @param {Buffer} data Data to store
   * @param {Knex.Transaction} _trx Transaction object.
   * @returns {Promise<void>} Void
   */
  store: async (
    uuid: string,
    data: Buffer,
    _trx: Knex.Transaction | undefined,
  ): Promise<void> => {
    const s3 = connectS3();
    const command = new PutObjectCommand({
      Body: data,
      Bucket: config.settings.s3.bucket,
      Key: uuid,
    });
    await s3.send(command);
  },

  /**
   * Remove file
   * @method removeFile
   * @param {string} uuid Uuid of the file to remove.
   * @param {Knex.Transaction} _trx Transaction object.
   * @returns {Promise<void>} Void
   */
  remove: async (uuid: string, _trx: Knex.Transaction): Promise<void> => {
    const s3 = connectS3();
    const command = new DeleteObjectCommand({
      Bucket: config.settings.s3.bucket,
      Key: uuid,
    });
    await s3.send(command);
  },

  /**
   * Copy file
   * @method copyFile
   * @param {string} source Uuid of the source file.
   * @param {string} target Uuid of the target file.
   * @param {Knex.Transaction} _trx Transaction object.
   * @returns {Promise<void>} Void
   */
  copy: async (
    source: string,
    target: string,
    _trx: Knex.Transaction | undefined,
  ): Promise<void> => {
    const s3 = connectS3();
    const command = new CopyObjectCommand({
      Bucket: config.settings.s3.bucket,
      CopySource: `${config.settings.s3.bucket}/${source}`,
      Key: target,
    });
    await s3.send(command);
  },
};
