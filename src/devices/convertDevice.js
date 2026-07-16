// -----------------------------------------------------------------------------
// Convert a MELCloud device entry (from User/ListDevices) into a Gladys
// discovered-device payload.
//
// External id scheme (built with gladys.externalIds(), mandatory prefix
// `ext:<selector>:`):
//   device  -> ext:<selector>:<type>:<DeviceID>     e.g. ext:melcloud:air-to-air:123
//   feature -> ext:<selector>:<type>:<DeviceID>:<power|mode|temperature>
//
// The MELCloud BuildingID is stored as a device param: Gladys sends the params
// back with every poll / set-value command, and Device/Get requires it.
// -----------------------------------------------------------------------------

import { MELCLOUD_DEVICE_TYPES, POLL_FREQUENCY } from '../constants.js';
import { buildAirToAirFeatures } from './airToAir.js';

export const BUILDING_ID_PARAM = 'buildingID';

// Namespace of the external ids, per MELCloud device type.
const DEVICE_TYPE_SLUGS = {
  [MELCLOUD_DEVICE_TYPES.AIR_TO_AIR]: 'air-to-air',
  [MELCLOUD_DEVICE_TYPES.AIR_TO_WATER]: 'air-to-water',
  [MELCLOUD_DEVICE_TYPES.ENERGY_RECOVERY_VENTILATION]: 'energy-recovery-ventilation',
};

/**
 * @param {import('@gladysassistant/integration-sdk').GladysIntegration} gladys
 * @param {object} melCloudDevice MELCloud device entry
 * @returns {object} Gladys discovered device
 */
export function convertDevice(gladys, melCloudDevice) {
  const deviceType = melCloudDevice.Device?.DeviceType;
  const slug = DEVICE_TYPE_SLUGS[deviceType] ?? 'unknown';
  const ids = gladys.externalIds(slug, String(melCloudDevice.DeviceID));

  const gladysDevice = {
    name: melCloudDevice.DeviceName,
    external_id: ids.device,
    model: melCloudDevice.Device?.Units?.[0]?.Model ?? null,
    poll_frequency: POLL_FREQUENCY,
    should_poll: true,
    features: [],
    params: [
      {
        name: BUILDING_ID_PARAM,
        value: melCloudDevice.BuildingID,
      },
    ],
  };

  switch (deviceType) {
    case MELCLOUD_DEVICE_TYPES.AIR_TO_AIR:
      gladysDevice.features = buildAirToAirFeatures(ids.device, melCloudDevice);
      break;
    case MELCLOUD_DEVICE_TYPES.AIR_TO_WATER:
    case MELCLOUD_DEVICE_TYPES.ENERGY_RECOVERY_VENTILATION:
    default:
      // Not supported yet: the device is listed without features.
      break;
  }

  return gladysDevice;
}

/**
 * Read the MELCloud BuildingID stored in the device params.
 * @param {object} device Gladys device (as sent with poll / set-value commands)
 * @returns {string|number} the BuildingID
 */
export function getBuildingId(device) {
  const param = (device.params || []).find(({ name }) => name === BUILDING_ID_PARAM);
  if (!param) {
    throw new Error(`MELCloud device "${device.external_id}" has no "${BUILDING_ID_PARAM}" param`);
  }
  return param.value;
}
