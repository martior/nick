/**
 * S3 blobs tests.
 * @module blobs/s3/s3.test
 */

// External imports
import { S3Client } from '@aws-sdk/client-s3';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Internal imports
import config from '../../helpers/config/config';
import { s3, s3ClientConfig } from './s3';

describe('s3', () => {
  const settings = config.settings.s3;

  beforeEach(() => {
    config.settings.s3 = {
      bucket: 'nick',
      region: 'us-east-1',
      endpoint: 'http://minio:9000',
      forcePathStyle: true,
      accessKeyId: 'key',
      secretAccessKey: 'secret',
    };
  });

  afterEach(() => {
    config.settings.s3 = settings;
    vi.restoreAllMocks();
  });

  it('should use a custom endpoint with path-style addressing', async () => {
    const options = s3ClientConfig();
    expect(options).toEqual({
      region: 'us-east-1',
      endpoint: 'http://minio:9000',
      forcePathStyle: true,
      credentials: { accessKeyId: 'key', secretAccessKey: 'secret' },
    });

    // The client sends requests to the endpoint, with the bucket in the path
    const client = new S3Client(options);
    const endpoint = await (client.config as any).endpoint();
    expect(endpoint.hostname).toBe('minio');
    expect(endpoint.port).toBe(9000);
    expect(client.config.forcePathStyle).toBe(true);
  });

  it('should use the default credential chain without keys', () => {
    config.settings.s3 = { bucket: 'nick', region: 'eu-west-1' };
    expect(s3ClientConfig()).toEqual({
      region: 'eu-west-1',
      forcePathStyle: false,
    });
  });

  it('should store blobs in the bucket', async () => {
    const send = vi
      .spyOn(S3Client.prototype, 'send')
      .mockResolvedValue({} as never);
    await s3.store('a95388f2', Buffer.from('data'), undefined);
    await s3.copy('a95388f2', 'b95388f2', undefined);

    expect(send.mock.calls[0][0].input).toMatchObject({
      Bucket: 'nick',
      Key: 'a95388f2',
    });
    expect(send.mock.calls[1][0].input).toMatchObject({
      Bucket: 'nick',
      CopySource: 'nick/a95388f2',
      Key: 'b95388f2',
    });
  });
});
