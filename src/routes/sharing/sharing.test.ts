/**
 * Sharing tests.
 * @module routes/sharing/sharing
 */

// External imports
import request from 'supertest';
import { describe, expect, it } from 'vitest';

// Internal imports
import app from '../../app';
import {
  adminToken,
  createUserWithToken,
  testRequest,
} from '../../helpers/tests/tests';
import { User } from '../../models/user/user';

describe('Sharing', () => {
  it('should get sharing information', () => testRequest(app, 'sharing/get'));

  it('should get sharing information with search', () =>
    testRequest(app, 'sharing/get_search'));

  it('should set new sharing information', () =>
    testRequest(app, 'sharing/post'));

  it('should only revoke a role on the item itself', async () => {
    await createUserWithToken('editor');
    const share = (path: string, value: boolean) =>
      request(app)
        .post(`${path}/@sharing`)
        .set('Accept', 'application/json')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          entries: [{ id: 'editor', type: 'user', roles: { Editor: value } }],
          inherit: true,
        })
        .expect(204);
    await share('/news', true);
    await share('/events', true);

    // Revoke on news only
    await share('/news', false);
    const editor = await User.fetchById('editor', {}, global.txn!);
    const roles = async (uuid: string) =>
      await editor.fetchRolesByDocument(uuid, global.txn!);
    expect(await roles('32215c67-86de-462a-8cc0-eabcd2b39c26')).toEqual([]);
    expect(await roles('1a2123ba-14e8-4910-8e6b-c04a40d72a41')).toEqual([
      'Editor',
    ]);
  });
});
