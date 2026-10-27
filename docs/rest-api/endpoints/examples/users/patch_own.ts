import { Client } from '@plone/nick';

const cli = Client.initialize({ apiPath: 'http://localhost:8080' });
const login = await cli.login({
  data: { login: 'headlessnick', password: 'nearlyheadless' },
});

const { data } = await cli.updateUser({
  token: login.data.token,
  params: 'headlessnick',
  data: {
    fullname: 'Headless Nick',
  },
});
