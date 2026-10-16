import { Client } from '@plone/nick';

const cli = Client.initialize({ apiPath: 'http://localhost:8080' });
const login = await cli.login({
  data: { login: 'admin', password: 'admin' },
});

const { data } = await cli.getVocabulary({
  token: login.data.token,
  params: { id: 'roles' },
  query: {
    b_size: 2,
    b_start: 2,
  },
});
