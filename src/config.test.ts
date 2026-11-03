import { expect, it } from 'vitest';
import config from '../vite.config';

// The base is part of the OAuth redirect URI registered with Google, so changing
// it breaks sign-in until https://devjonny.github.io/<base> is registered too.
it('serves the app from the GitHub Pages project path', () => {
  expect(config).toMatchObject({ base: '/Antigone/' });
});
