import { Client } from '@plone/nick';

const cli = Client.initialize({ apiPath: 'http://localhost:8080' });
const login = await cli.login({
  data: { login: 'admin', password: 'admin' },
});

const { data } = await cli.getQuerystringSearch({
  token: login.data.token,
  query: {
    query: JSON.stringify({
      query: [
        {
          i: 'portal_type',
          o: 'plone.app.querystring.operation.selection.any',
          v: ['Event'],
        },
      ],
      sort_on: 'getId',
    }),
  },
});
