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
import { createDocument, testRequest } from '../../helpers/tests/tests';
import models from '../../models';

const token =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhZG1pbiIsImZ1bGxuYW1lIjoiQWRtaW4iLCJpYXQiOjE2NDkzMTI0NDl9.RS1Ny_r0v7vIylFfK6q0JVJrkiDuTOh9iG9IL8xbzAk';

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
});
