import { Client } from '@plone/nick';

const cli = Client.initialize({ apiPath: 'http://localhost:8080' });
const login = await cli.login({
  data: { login: 'admin', password: 'admin' },
});

const { data } = await cli.getUsers({
  token: login.data.token,
  query: {
    'groups-filter:list': 'Administrators',
    limit: 10,
  },
});
