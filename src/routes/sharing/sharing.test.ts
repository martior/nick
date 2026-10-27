/**
 * Sharing tests.
 * @module routes/sharing/sharing
 */

// External imports
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

// Internal imports
import app from '../../app';
import config from '../../helpers/config/config';
import jobs from '../../helpers/jobs/jobs';
import {
  adminToken,
  createDocument,
  createUser,
  createUserWithToken,
  testRequest,
} from '../../helpers/tests/tests';
import models from '../../models';
import { User } from '../../models/user/user';

const token = adminToken;

/**
 * Get the allowed users, groups and roles from the catalog
 * @method allowed
 * @param {string} uuid Uuid of the document.
 * @returns {Promise<string[]>} Allowed users, groups and roles.
 */
async function allowed(uuid: string): Promise<string[]> {
  const row = await global.txn!('catalog').where({ document: uuid }).first();
  return row._allowedUsersGroupsRoles;
}

/**
 * Post sharing data
 * @method share
 * @param {string} path Path of the document.
 * @param {Object} body Sharing data.
 * @returns {Promise<void>}
 */
async function share(path: string, body: any): Promise<void> {
  await request(app)
    .post(`${path}/@sharing`)
    .set('Accept', 'application/json')
    .set('Authorization', `Bearer ${token}`)
    .send(body)
    .expect(204);
}

describe('Sharing', () => {
  it('should get sharing information', () => testRequest(app, 'sharing/get'));

  it('should get sharing information with search', () =>
    testRequest(app, 'sharing/get_search'));

  it('should set new sharing information', () =>
    testRequest(app, 'sharing/post'));

  it('should reindex the permissions of the subtree', async () => {
    const Document = models.get('Document');
    const User = models.get('User');
    await User.create(
      { id: 'jane', fullname: 'Jane', password: 'secret' },
      {},
      global.txn!,
    );
    const news = await Document.fetchOne({ path: '/news' }, {}, global.txn!);
    const team = await createDocument(
      '0f2c9a41-6d3e-4c55-8f6a-2b7d9e1c4a01',
      news,
      'team',
      'Folder',
    );
    const page = await createDocument(
      '0f2c9a41-6d3e-4c55-8f6a-2b7d9e1c4a02',
      team,
      'page',
      'Page',
    );
    expect(await allowed(page.uuid)).not.toContain('user:jane');

    // Grant a local role on a parent
    await share('/news', {
      entries: [{ id: 'jane', type: 'user', roles: { Editor: true } }],
      inherit: true,
    });
    expect(await allowed(team.uuid)).toContain('user:jane');
    expect(await allowed(page.uuid)).toContain('user:jane');

    // Block inheritance below the parent
    await share('/news/team', { entries: [], inherit: false });
    expect(await allowed(team.uuid)).not.toContain('user:jane');
    expect(await allowed(page.uuid)).not.toContain('user:jane');

    // Restore inheritance and revoke the role
    await share('/news/team', { entries: [], inherit: true });
    expect(await allowed(page.uuid)).toContain('user:jane');
    await share('/news', {
      entries: [{ id: 'jane', type: 'user', roles: { Editor: false } }],
      inherit: true,
    });
    expect(await allowed(page.uuid)).not.toContain('user:jane');
  });

  it('should reindex large subtrees in a job', async () => {
    const Job = models.get('Job');
    const check = vi.spyOn(jobs, 'check').mockResolvedValue(undefined);
    config.settings.reindexSecurityLimit = 1;
    await share('/events', { entries: [], inherit: false });
    delete config.settings.reindexSecurityLimit;

    const job = await Job.fetchOne({ status: 'created' }, {}, global.txn!);
    expect(job.params).toEqual({
      action: 'reindex_security',
      path: '/events',
    });
    expect(check).toHaveBeenCalled();
    check.mockRestore();
  });

  it('should accept partial sharing data', async () => {
    const Document = models.get('Document');
    await share('/news', {});
    await share('/news', { inherit: false });
    const news = await Document.fetchOne({ path: '/news' }, {}, global.txn!);
    expect(news.inherit_roles).toBe(false);
    await share('/news', {
      entries: [
        {
          id: 'admin',
          type: 'user',
          roles: { NoSuchRole: true, Reader: true },
        },
      ],
    });
    const roles = await global.txn!('user_role_document').where({
      document: news.uuid,
    });
    expect(roles.map((role: any) => role.role)).toEqual(['Reader']);
  });

  it('should refuse invalid sharing data', async () => {
    const post = (body: any) =>
      request(app)
        .post('/news/@sharing')
        .set('Accept', 'application/json')
        .set('Authorization', `Bearer ${token}`)
        .send(body);
    await post({ inherit: 'yes' }).expect(400);
    await post({ entries: 'admin' }).expect(400);
    await post({ entries: [{ id: 'admin', type: 'robot', roles: {} }] }).expect(
      400,
    );
    await post({ entries: [{ id: 'admin', type: 'user' }] }).expect(400);
  });

  it('should list principals with local roles', async () => {
    const Document = models.get('Document');
    await createUser('jane');
    const news = await Document.fetchOne({ path: '/news' }, {}, global.txn!);
    await createDocument(
      '0f2c9a41-6d3e-4c55-8f6a-2b7d9e1c4a03',
      news,
      'child',
      'Page',
    );
    await share('/news', {
      entries: [{ id: 'jane', type: 'user', roles: { Reader: true } }],
    });
    const get = (path: string) =>
      request(app)
        .get(`${path}/@sharing`)
        .set('Accept', 'application/json')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

    const entries = (await get('/news')).body.entries;
    expect(entries.map((entry: any) => entry.id)).toEqual(['jane']);
    expect(entries[0].roles.Reader).toBe(true);

    const child = (await get('/news/child')).body.entries;
    expect(child[0].roles.Reader).toBe('acquired');

    // Search by id
    const search = await request(app)
      .get('/news/@sharing?search=adm')
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(search.body.entries.map((entry: any) => entry.id)).toEqual([
      'admin',
      'Administrators',
      'jane',
    ]);
  });

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

  it('should only delegate roles the user may delegate', async () => {
    const token = await createUserWithToken('editor');
    await createUserWithToken('other');
    await request(app)
      .post('/news/@sharing')
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        entries: [{ id: 'editor', type: 'user', roles: { Editor: true } }],
        inherit: true,
      })
      .expect(204);

    // The editor only gets the roles it may delegate
    const res = await request(app)
      .get('/news/@sharing')
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body.available_roles.map((role: any) => role.id)).toEqual([
      'Editor',
      'Reader',
    ]);

    // Other roles are ignored
    await request(app)
      .post('/news/@sharing')
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ${token}`)
      .send({
        entries: [
          {
            id: 'other',
            type: 'user',
            roles: { Administrator: true, Reviewer: true, Editor: true },
          },
        ],
        inherit: true,
      })
      .expect(204);
    const other = await User.fetchById('other', {}, global.txn!);
    expect(
      await other.fetchRolesByDocument(
        '32215c67-86de-462a-8cc0-eabcd2b39c26',
        global.txn!,
      ),
    ).toEqual(['Editor']);
  });
});
