/**
 * Export helper tests.
 * @module helpers/export/export.test
 */

// External imports
import { describe, it, expect } from 'vitest';

// Internal imports
import {
  convertBehaviors,
  convertUserList,
  convertWorkflow,
  convertWorkflowHistory,
  fetchAllBatches,
  forEachBatch,
  generatePassword,
  getAcquiredState,
  getCustomRoles,
  getDocumentFilename,
  getDocumentPath,
  getItems,
  mapPrincipalRoles,
  parseTar,
  parseWorkflowBindings,
  parseXml,
} from './export';

/**
 * Fake batched endpoint.
 * @param {number} total Number of items.
 * @param {boolean} batching Return batching links.
 * @returns {Object} Fetch function and requested urls.
 */
const batchedEndpoint = (total: number, batching: boolean) => {
  const urls: string[] = [];
  const fetch = async (url: string) => {
    urls.push(url);
    const params = new URL(url).searchParams;
    const start = parseInt(params.get('b_start') || '0');
    const size = parseInt(params.get('b_size') || '25');
    const items = Array.from(
      { length: Math.max(0, Math.min(size, total - start)) },
      (_value, index) => ({ id: start + index }),
    );
    return {
      items,
      items_total: total,
      ...(batching && start + size < total
        ? {
            batching: {
              next: `http://host/@search?sort_on=path&b_size=${size}&b_start=${start + size}`,
            },
          }
        : {}),
    };
  };
  return { fetch, urls };
};

describe('export', () => {
  describe('getDocumentPath', () => {
    it('returns the root path for the site url', () => {
      expect(getDocumentPath('http://host/plone', 'http://host/plone')).toBe(
        '/',
      );
    });

    it('returns the decoded path of a document', () => {
      expect(
        getDocumentPath(
          'http://host/plone/news/my%20item',
          'http://host/plone',
        ),
      ).toBe('/news/my item');
    });
  });

  describe('getDocumentFilename', () => {
    it('returns _root.json for the root', () => {
      expect(getDocumentFilename('/')).toBe('_root.json');
    });

    it('separates path segments with dots', () => {
      expect(getDocumentFilename('/news/item-1')).toBe('news.item-1.json');
    });

    it('escapes dots and other characters in ids', () => {
      expect(getDocumentFilename('/files/report.pdf')).toBe(
        'files.report~2epdf.json',
      );
      expect(getDocumentFilename('/über uns')).toBe('~c3~bcber~20uns.json');
    });

    it('keeps parents before children when sorted', () => {
      const files = ['/a.b/c', '/a-b', '/a.b', '/a']
        .map((path) => getDocumentFilename(path).replace(/\.json$/, ''))
        .sort();
      expect(files.indexOf('a~2eb')).toBeLessThan(files.indexOf('a~2eb.c'));
    });
  });

  describe('forEachBatch', () => {
    it('follows the batching links', async () => {
      const { fetch, urls } = batchedEndpoint(250, true);
      const sizes: number[] = [];
      const count = await forEachBatch(
        'http://host/@search?sort_on=path',
        fetch,
        (items) => {
          sizes.push(items.length);
        },
        100,
      );
      expect(count).toBe(250);
      expect(sizes).toEqual([100, 100, 50]);
      expect(urls[0]).toBe(
        'http://host/@search?sort_on=path&b_size=100&b_start=0',
      );
    });

    it('falls back to items_total without batching links', async () => {
      const { fetch, urls } = batchedEndpoint(120, false);
      const items = await fetchAllBatches('http://host/@users', fetch, 50);
      expect(items.map((item: any) => item.id)).toEqual(
        Array.from({ length: 120 }, (_value, index) => index),
      );
      expect(urls).toHaveLength(3);
    });

    it('treats an array as a single batch', async () => {
      const items = await fetchAllBatches('http://host/@groups', async () => [
        { id: 'a' },
        { id: 'b' },
      ]);
      expect(items).toEqual([{ id: 'a' }, { id: 'b' }]);
    });
  });

  describe('mapPrincipalRoles', () => {
    it('maps Plone roles to Nick roles', () => {
      expect(
        mapPrincipalRoles([
          'Manager',
          'Site Administrator',
          'Member',
          'Authenticated',
          'Reviewer',
          'Custom',
        ]),
      ).toEqual(['Administrator', 'Reviewer', 'Custom']);
    });
  });

  describe('getCustomRoles', () => {
    it('returns only roles missing in Nick', () => {
      expect(
        getCustomRoles([
          { id: 'Manager' },
          { id: 'Member' },
          { id: 'Editor' },
          { id: 'Site Administrator' },
          { id: 'Custom' },
        ]),
      ).toEqual([{ id: 'Custom' }]);
    });
  });

  describe('generatePassword', () => {
    it('returns a different password every time', () => {
      expect(generatePassword()).not.toBe(generatePassword());
      expect(generatePassword().length).toBeGreaterThanOrEqual(32);
    });
  });

  describe('convertUserList', () => {
    const users = [
      {
        '@id': 'http://host/plone/@users/jane',
        id: 'jane',
        username: 'jane',
        fullname: 'Jane Doe',
        email: 'jane@example.org',
        location: 'Oslo',
        roles: ['Member', 'Reviewer'],
        groups: {
          items: [{ id: 'AuthenticatedUsers' }, { id: 'staff' }],
        },
      },
      {
        id: 'john',
        username: 'john',
        fullname: 'John Doe',
        email: 'john@example.org',
        roles: ['Member'],
        groups: { items: [] },
      },
    ];

    it('gives every user its own password', () => {
      const output = convertUserList(users, {
        login: 'admin',
        password: 'secret',
      });
      expect(output[0].password).not.toBe(output[1].password);
      expect(output[0]).toMatchObject({
        id: 'jane',
        fullname: 'Jane Doe',
        email: 'jane@example.org',
        location: 'Oslo',
        roles: ['Reviewer'],
        groups: ['staff'],
      });
    });

    it('adds the user running the export with its password', () => {
      const output = convertUserList(users, {
        login: 'admin',
        password: 'secret',
      });
      expect(output[2]).toMatchObject({
        id: 'admin',
        password: 'secret',
        roles: ['Administrator'],
      });
    });

    it('adds users referenced by content without roles', () => {
      const output = convertUserList(
        users,
        { login: 'jane', password: 'secret' },
        ['jane', 'removed', 'removed', 'anonymous'],
      );
      expect(output.map((user: any) => user.id)).toEqual([
        'jane',
        'john',
        'removed',
      ]);
      expect(output[0].password).toBe('secret');
      expect(output[2].roles).toEqual([]);
    });
  });

  describe('getItems', () => {
    it('returns the items of a listing', () => {
      expect(getItems([{ id: 'a' }])).toEqual([{ id: 'a' }]);
      expect(getItems({ items: [{ id: 'b' }] })).toEqual([{ id: 'b' }]);
      expect(getItems({ message: 'error' })).toEqual([]);
    });
  });

  describe('convertBehaviors', () => {
    it('maps enabled Plone behaviors to Nick behaviors', () => {
      expect(
        convertBehaviors({
          'plone.dublincore': true,
          'plone.versioning': true,
          'plone.locking': true,
          'volto.blocks': true,
          'plone.shortname': false,
          title: 'Page',
        }),
      ).toEqual(['dublin_core', 'versioning', 'blocks']);
    });

    it('adds folderish and navigation root', () => {
      expect(
        convertBehaviors(
          { 'plone.navigationroot': true },
          { folderish: true, navroot: true },
        ),
      ).toEqual(['navigation_root', 'folderish']);
    });
  });

  describe('parseTar', () => {
    it('reads the files of a tar archive', () => {
      const header = (name: string, size: number) => {
        const block = Buffer.alloc(512);
        block.write(name, 0);
        block.write(`${size.toString(8).padStart(11, '0')}\0`, 124);
        block.write('0', 156);
        return block;
      };
      const content = Buffer.from('<object/>');
      const archive = Buffer.concat([
        header('workflows.xml', content.length),
        content,
        Buffer.alloc(512 - content.length),
        Buffer.alloc(1024),
      ]);
      expect(parseTar(archive)).toEqual({ 'workflows.xml': '<object/>' });
    });
  });

  describe('parseXml', () => {
    it('parses elements, attributes and text', () => {
      const root = parseXml(
        '<?xml version="1.0"?><a x="1 &amp; 2"><!-- c --><b>T &lt;b&gt;</b><c/></a>',
      );
      expect(root.name).toBe('a');
      expect(root.attributes.x).toBe('1 & 2');
      expect(root.children.map((child) => child.name)).toEqual(['b', 'c']);
      expect(root.children[0].text).toBe('T <b>');
    });
  });

  describe('convertWorkflow', () => {
    const xml = `<?xml version="1.0"?>
<dc-workflow workflow_id="intranet" title="Intranet" description=" - Only for - members." initial_state="internal">
 <permission>View</permission>
 <state state_id="internal" title="Internal draft">
  <description>Draft</description>
  <exit-transition transition_id="publish"/>
  <permission-map name="View" acquired="False">
   <permission-role>Manager</permission-role>
   <permission-role>Member</permission-role>
   <permission-role>Owner</permission-role>
  </permission-map>
  <permission-map name="Access contents information" acquired="False">
   <permission-role>Member</permission-role>
  </permission-map>
  <permission-map name="Modify portal content" acquired="False">
   <permission-role>Site Administrator</permission-role>
   <permission-role>Owner</permission-role>
  </permission-map>
 </state>
 <state state_id="external" title="Externally visible">
  <exit-transition transition_id="retract"/>
  <permission-map name="View" acquired="False">
   <permission-role>Anonymous</permission-role>
  </permission-map>
 </state>
 <transition transition_id="publish" title="Reviewer publishes" new_state="external">
  <action url="" category="workflow" icon="">Publish externally</action>
  <guard><guard-permission>Review portal content</guard-permission></guard>
 </transition>
 <transition transition_id="retract" title="Retract" new_state="internal">
  <guard><guard-role>Manager</guard-role></guard>
 </transition>
</dc-workflow>`;

    it('converts states, permissions and transitions', () => {
      const workflow = convertWorkflow(xml);
      expect(workflow.id).toBe('intranet');
      expect(workflow.description).toBe('Only for members.');
      expect(workflow.json.initial_state).toBe('internal');
      expect(workflow.json.states.internal).toEqual({
        title: 'Internal draft',
        description: 'Draft',
        transitions: ['publish'],
        permissions: {
          Administrator: ['View', 'Modify'],
          Authenticated: ['View'],
          Owner: ['View', 'Modify'],
        },
      });
      expect(workflow.json.states.external.permissions).toEqual({
        Anonymous: ['View'],
        Authenticated: ['View'],
      });
      expect(workflow.json.transitions).toEqual({
        publish: {
          title: 'Publish externally',
          description: '',
          new_state: 'external',
          permission: 'Review',
        },
        retract: {
          title: 'Retract',
          description: '',
          new_state: 'internal',
          permission: 'Manage Site',
        },
      });
    });

    it('gets the state of documents without workflow', () => {
      const workflow = convertWorkflow(xml);
      expect(getAcquiredState(workflow)).toBe('external');
      expect(getAcquiredState(workflow, 'external')).toBe('external');
      expect(getAcquiredState(workflow, 'unknown')).toBe('internal');
    });
  });

  describe('parseWorkflowBindings', () => {
    it('reads the default chain and the chains by type', () => {
      expect(
        parseWorkflowBindings(`<object name="portal_workflow">
 <bindings>
  <default><bound-workflow workflow_id="simple_publication_workflow"/></default>
  <type type_id="Event"><bound-workflow workflow_id="intranet_workflow"/></type>
  <type type_id="File"/>
 </bindings>
</object>`),
      ).toEqual({
        default: ['simple_publication_workflow'],
        types: { Event: ['intranet_workflow'], File: [] },
      });
    });
  });

  describe('convertWorkflowHistory', () => {
    it('converts the workflow history with titles and comments', () => {
      const workflow = {
        json: {
          states: { private: { title: 'Private' } },
          transitions: { publish: { title: 'Publish' } },
        },
      };
      expect(
        convertWorkflowHistory(
          [
            {
              action: null,
              actor: 'jane',
              comments: '',
              review_state: 'private',
              time: '2026-01-01T10:00:00+00:00',
              title: 'Private',
            },
            {
              action: 'publish',
              actor: 'john',
              comments: 'Approved',
              review_state: 'published',
              time: '2026-01-02T10:00:00+00:00',
              title: 'Published',
            },
          ],
          workflow,
        ),
      ).toEqual([
        {
          action: null,
          actor: 'jane',
          comments: '',
          review_state: 'private',
          state_title: 'Private',
          time: '2026-01-01T10:00:00+00:00',
          transition_title: 'Create',
        },
        {
          action: 'publish',
          actor: 'john',
          comments: 'Approved',
          review_state: 'published',
          state_title: 'Published',
          time: '2026-01-02T10:00:00+00:00',
          transition_title: 'Publish',
        },
      ]);
    });
  });
});
