import { Client } from '@plone/nick';

const cli = Client.initialize({ apiPath: 'http://localhost:8080' });
const login = await cli.login({
  data: { login: 'admin', password: 'admin' },
});

const { data } = await cli.querystringSearch({
  token: login.data.token,
  data: {
    query: [
      {
        i: 'Title',
        o: 'plone.app.querystring.operation.string.unknown',
        v: 'News',
      },
    ],
  },
});
