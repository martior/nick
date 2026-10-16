import { Client } from '@plone/nick';

const cli = Client.initialize({ apiPath: 'http://localhost:8080' });
const login = await cli.login({
  data: { login: 'admin', password: 'admin' },
});

const { data } = await cli.createAliases({
  token: login.data.token,
  path: '/news',
  data: {
    items: [
      {
        path: '/events',
      },
      {
        path: '/news-posts',
      },
    ],
  },
});
