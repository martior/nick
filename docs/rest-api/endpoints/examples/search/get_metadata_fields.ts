import { Client } from '@plone/nick';

const cli = Client.initialize({ apiPath: 'http://localhost:8080' });
const login = await cli.login({
  data: { login: 'admin', password: 'admin' },
});

const { data } = await cli.search({
  token: login.data.token,
  query: {
    portal_type: 'Event',
    metadata_fields: ['UID', 'Subject'],
  },
});
