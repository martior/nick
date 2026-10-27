import { Client } from '@plone/nick';

const cli = Client.initialize({ apiPath: 'http://localhost:8080' });
const login = await cli.login({
  data: {
    query: [
      {
        i: 'portal_type',
        o: 'plone.app.querystring.operation.selection.any',
        v: ['Event', 'Folder'],
      },
    ],
    sort_on: 'getId',
    b_size: 1,
    b_start: 1,
    limit: 3,
  },
});
