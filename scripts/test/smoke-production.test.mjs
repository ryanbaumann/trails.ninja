import assert from 'node:assert/strict';
import test from 'node:test';

import { expectedPublicAppNames, findServerSecretMarker } from '../lib/production-smoke.mjs';

const apps = [
  { name: 'fieldwork', path: '/' },
  { name: 'demo', path: '/demo/' },
];

test('production smoke expects the checked-out root app by default', () => {
  assert.deepEqual(expectedPublicAppNames(apps), ['demo', 'fieldwork']);
});

test('production smoke can verify a legacy root app during a parallel-service cutover', () => {
  assert.deepEqual(expectedPublicAppNames(apps, 'portfolio'), ['demo', 'portfolio']);
});

test('production smoke rejects an ambiguous compatibility override', () => {
  assert.throws(
    () => expectedPublicAppNames([{ name: 'demo', path: '/demo/' }], 'portfolio'),
    /requires exactly one public root app/,
  );
});

test('production secret scan allows schema field names but rejects assigned secret values', () => {
  assert.equal(findServerSecretMarker('type: "oauth2:client_credentials"; value.client_secret != null'), undefined);
  assert.equal(findServerSecretMarker('client_secret: "fixture"'), undefined);
  assert.equal(findServerSecretMarker('client_secret: "actual-secret-value-123"')?.[0], 'OAuth client secret value');
});
