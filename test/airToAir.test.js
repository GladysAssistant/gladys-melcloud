import test from 'node:test';
import assert from 'node:assert/strict';

import { buildAirToAirFeatures, buildPollStates, buildSetAtaChanges } from '../src/devices/airToAir.js';
import { AC_MODE } from '../src/constants.js';
import { AIR_TO_AIR_DEVICE, DEVICE_STATE } from './fixtures.js';

const EXTERNAL_ID = 'ext:melcloud:air-to-air:123';

test('buildAirToAirFeatures exposes power, mode and target temperature', () => {
  const features = buildAirToAirFeatures(EXTERNAL_ID, AIR_TO_AIR_DEVICE);
  assert.equal(features.length, 3);

  const [power, mode, temperature] = features;
  assert.deepEqual(
    { external_id: power.external_id, category: power.category, type: power.type },
    { external_id: 'ext:melcloud:air-to-air:123:power', category: 'air-conditioning', type: 'binary' },
  );
  assert.deepEqual(
    { external_id: mode.external_id, category: mode.category, type: mode.type },
    { external_id: 'ext:melcloud:air-to-air:123:mode', category: 'air-conditioning', type: 'mode' },
  );
  assert.deepEqual(
    { external_id: temperature.external_id, category: temperature.category, type: temperature.type },
    { external_id: 'ext:melcloud:air-to-air:123:temperature', category: 'air-conditioning', type: 'target-temperature' },
  );
  // The temperature bounds come from the MELCloud unit.
  assert.equal(temperature.min, 16);
  assert.equal(temperature.max, 31);
  // Every feature is a controllable one with device feedback.
  features.forEach((feature) => {
    assert.equal(feature.read_only, false);
    assert.equal(feature.has_feedback, true);
  });
});

test('buildPollStates maps the MELCloud state to Gladys states', () => {
  const states = buildPollStates(EXTERNAL_ID, DEVICE_STATE);
  assert.deepEqual(states, [
    { device_feature_external_id: 'ext:melcloud:air-to-air:123:power', state: 1 },
    { device_feature_external_id: 'ext:melcloud:air-to-air:123:mode', state: AC_MODE.HEATING },
    { device_feature_external_id: 'ext:melcloud:air-to-air:123:temperature', state: 21 },
  ]);
});

test('buildPollStates skips an unknown MELCloud mode', () => {
  const states = buildPollStates(EXTERNAL_ID, { ...DEVICE_STATE, Power: false, OperationMode: 99 });
  assert.deepEqual(states, [
    { device_feature_external_id: 'ext:melcloud:air-to-air:123:power', state: 0 },
    { device_feature_external_id: 'ext:melcloud:air-to-air:123:temperature', state: 21 },
  ]);
});

test('buildSetAtaChanges maps Gladys commands to SetAta payloads', () => {
  assert.deepEqual(buildSetAtaChanges('power', 1), { EffectiveFlags: 1, Power: true });
  assert.deepEqual(buildSetAtaChanges('power', 0), { EffectiveFlags: 1, Power: false });
  assert.deepEqual(buildSetAtaChanges('mode', AC_MODE.COOLING), { EffectiveFlags: 6, OperationMode: 3 });
  assert.deepEqual(buildSetAtaChanges('mode', AC_MODE.AUTO), { EffectiveFlags: 6, OperationMode: 8 });
  assert.deepEqual(buildSetAtaChanges('temperature', 22.5), { EffectiveFlags: 4, SetTemperature: 22.5 });
  assert.equal(buildSetAtaChanges('unknown', 1), null);
});

test('mode mappings round-trip between Gladys and MELCloud', () => {
  const melCloudModes = { 1: AC_MODE.HEATING, 2: AC_MODE.DRYING, 3: AC_MODE.COOLING, 7: AC_MODE.FAN, 8: AC_MODE.AUTO };
  Object.entries(melCloudModes).forEach(([melCloudMode, gladysMode]) => {
    const [state] = buildPollStates(EXTERNAL_ID, { OperationMode: Number(melCloudMode) }).filter((s) =>
      s.device_feature_external_id.endsWith(':mode'),
    );
    assert.equal(state.state, gladysMode);
    assert.equal(buildSetAtaChanges('mode', gladysMode).OperationMode, Number(melCloudMode));
  });
});
