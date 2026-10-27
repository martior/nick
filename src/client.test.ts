/**
 * Client tests.
 * @module client.test
 */

// External imports
import { describe, expect, it } from 'vitest';

// Internal imports
import { adminToken } from './helpers/tests/tests';
import { Client } from './index';

describe('Client', () => {
  it('should call the api like the examples in the docs', async () => {
    // See docs/rest-api/endpoints/examples/types/get.ts; the login token is
    // the one mocked in the test setup, so the calls use the admin token
    const cli = Client.initialize({ apiPath: 'http://localhost:8080' });
    const login = await cli.login({
      data: { login: 'admin', password: 'admin' },
    });
    expect(typeof login.data.token).toBe('string');

    const { data } = await cli.getType({
      token: adminToken,
      params: {
        type: 'Page',
      },
    });
    expect(data.title).toBe('Page');

    // Content with a lock token
    const content = await cli.getContent({
      token: adminToken,
      path: '/news',
      locktoken: 'token',
    });
    expect(content.data['@id']).toBe('http://localhost:8080/news');
  });
});
