import { Client } from '@plone/nick';

const cli = Client.initialize({ apiPath: 'http://localhost:8080' });
const login = await cli.login({
  data: { login: 'admin', password: 'admin' },
});

const { data } = await cli.querystringSearch({
  token: login.data.token,
  path: '/events',
  data: {
    query: [
      {
        i: 'path',
        o: 'plone.app.querystring.operation.string.relativePath',
        v: '.',
      },
      {
        i: 'Subject',
        o: 'plone.app.querystring.operation.selection.any',
        v: ['event'],
      },
      {
        i: 'effective',
        o: 'plone.app.querystring.operation.date.lessThan',
        v: '2023-01-01',
      },
    ],
    sort_on: 'sortable_title',
  },
});
