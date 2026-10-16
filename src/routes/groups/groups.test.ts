/**
 * Groups tests.
 * @module routes/groups/groups
 */

// External imports
import { afterEach, describe, it } from 'vitest';

// Internal imports
import app from '../../app';
import { testRequest } from '../../helpers/tests/tests';

describe('Groups', () => {
  afterEach(async () => {
    await testRequest(app, 'groups/delete');
  });

  it('should get a list of groups', () => testRequest(app, 'groups/list'));

  it('should get a list of groups by query', () =>
    testRequest(app, 'groups/list_query'));

  it('should get an error when not logged in', () =>
    testRequest(app, 'groups/list_anonymous'));

  it('should get an individual group', () => testRequest(app, 'groups/get'));

  it('should not get a group when not logged in', () =>
    testRequest(app, 'groups/get_anonymous'));

  it('should not get a group when not found', () =>
    testRequest(app, 'groups/get_notfound'));

  it('should add a new group', () => testRequest(app, 'groups/post'));

  it('should not add a group without a group name', () =>
    testRequest(app, 'groups/post_without_groupname'));

  it('should not add a group which already exists', () =>
    testRequest(app, 'groups/post_duplicate'));

  it('should not add a group with an unknown role', () =>
    testRequest(app, 'groups/post_unknown_role'));

  it('should update a group', async () => {
    await testRequest(app, 'groups/post');
    return testRequest(app, 'groups/patch');
  });

  it('should delete a group', async () => {
    await testRequest(app, 'groups/post');
    return testRequest(app, 'groups/delete');
  });
});
