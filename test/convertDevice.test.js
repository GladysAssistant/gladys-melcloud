import test from 'node:test';
import assert from 'node:assert/strict';

import { convertDevice, getBuildingId } from '../src/devices/convertDevice.js';
import { AIR_TO_AIR_DEVICE, AIR_TO_WATER_DEVICE } from './fixtures.js';

// Minimal stand-in for the SDK: only externalId() is used by convertDevice.
const gladys = { externalId: (suffix) => `ext:melcloud:${suffix}` };

test('convertDevice converts an air-to-air unit', () => {
  const device = convertDevice(gladys, AIR_TO_AIR_DEVICE);

  assert.equal(device.name, 'Living room AC');
  assert.equal(device.external_id, 'ext:melcloud:123');
  assert.equal(device.model, 'MSZ-AP25VGK');
  assert.equal(device.poll_frequency, 10000);
  assert.equal(device.should_poll, true);
  assert.equal(device.features.length, 3);
  assert.deepEqual(device.params, [{ name: 'buildingID', value: 456 }]);
});

test('convertDevice lists unsupported device types without features', () => {
  const device = convertDevice(gladys, AIR_TO_WATER_DEVICE);

  assert.equal(device.external_id, 'ext:melcloud:789');
  assert.deepEqual(device.features, []);
  assert.deepEqual(device.params, [{ name: 'buildingID', value: 456 }]);
});

test('getBuildingId reads the buildingID param', () => {
  assert.equal(getBuildingId({ external_id: 'x', params: [{ name: 'buildingID', value: 456 }] }), 456);
  assert.throws(() => getBuildingId({ external_id: 'x', params: [] }), /has no "buildingID" param/);
  assert.throws(() => getBuildingId({ external_id: 'x' }), /has no "buildingID" param/);
});
