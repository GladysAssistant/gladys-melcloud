// -----------------------------------------------------------------------------
// Air-to-air (DeviceType 0) MELCloud unit.
//
// Exposes the same three features as the built-in Gladys MELCloud service:
//   - power       (air-conditioning / binary)
//   - mode        (air-conditioning / mode)
//   - temperature (air-conditioning / target-temperature)
// -----------------------------------------------------------------------------

import { DEVICE_FEATURE_CATEGORIES, DEVICE_FEATURE_TYPES } from '@gladysassistant/integration-sdk';

import { AC_MODE, EFFECTIVE_FLAGS, FEATURE_CODES } from '../constants.js';

// MELCloud OperationMode <-> Gladys AC_MODE.
const MODES_MELCLOUD_TO_GLADYS = {
  1: AC_MODE.HEATING,
  2: AC_MODE.DRYING,
  3: AC_MODE.COOLING,
  7: AC_MODE.FAN,
  8: AC_MODE.AUTO,
};

const MODES_GLADYS_TO_MELCLOUD = {
  [AC_MODE.HEATING]: 1,
  [AC_MODE.DRYING]: 2,
  [AC_MODE.COOLING]: 3,
  [AC_MODE.FAN]: 7,
  [AC_MODE.AUTO]: 8,
};

/**
 * Build the Gladys features of an air-to-air unit.
 * @param {string} externalId external id of the Gladys device
 * @param {object} melCloudDevice MELCloud device entry (from User/ListDevices)
 * @returns {Array} Gladys device features
 */
export function buildAirToAirFeatures(externalId, melCloudDevice) {
  return [
    {
      name: 'Power',
      external_id: `${externalId}:${FEATURE_CODES.POWER}`,
      read_only: false,
      has_feedback: true,
      min: 0,
      max: 1,
      category: DEVICE_FEATURE_CATEGORIES.AIR_CONDITIONING,
      type: DEVICE_FEATURE_TYPES.AIR_CONDITIONING.BINARY,
    },
    {
      name: 'Mode',
      external_id: `${externalId}:${FEATURE_CODES.MODE}`,
      read_only: false,
      has_feedback: true,
      min: 0,
      max: 1,
      category: DEVICE_FEATURE_CATEGORIES.AIR_CONDITIONING,
      type: DEVICE_FEATURE_TYPES.AIR_CONDITIONING.MODE,
    },
    {
      name: 'Temperature',
      external_id: `${externalId}:${FEATURE_CODES.TEMPERATURE}`,
      read_only: false,
      has_feedback: true,
      min: melCloudDevice.MinTemperature,
      max: melCloudDevice.MaxTemperature,
      category: DEVICE_FEATURE_CATEGORIES.AIR_CONDITIONING,
      type: DEVICE_FEATURE_TYPES.AIR_CONDITIONING.TARGET_TEMPERATURE,
    },
  ];
}

/**
 * Build the Gladys states of the three features from a Device/Get response.
 * States without a known value (e.g. an unknown MELCloud mode) are skipped.
 * @param {string} deviceExternalId external id of the Gladys device
 * @param {object} melCloudState Device/Get response
 * @returns {Array} states for gladys.publishStates()
 */
export function buildPollStates(deviceExternalId, melCloudState) {
  return [
    {
      device_feature_external_id: `${deviceExternalId}:${FEATURE_CODES.POWER}`,
      state: melCloudState.Power ? 1 : 0,
    },
    {
      device_feature_external_id: `${deviceExternalId}:${FEATURE_CODES.MODE}`,
      state: MODES_MELCLOUD_TO_GLADYS[melCloudState.OperationMode],
    },
    {
      device_feature_external_id: `${deviceExternalId}:${FEATURE_CODES.TEMPERATURE}`,
      state: melCloudState.SetTemperature,
    },
  ].filter((state) => state.state !== null && state.state !== undefined);
}

/**
 * Build the properties to merge into a Device/SetAta payload for a Gladys
 * command. Returns null when the feature is not controllable.
 * @param {string} featureCode last segment of the feature external id
 * @param {number} value value sent by Gladys
 * @returns {object|null} partial SetAta payload (with EffectiveFlags)
 */
export function buildSetAtaChanges(featureCode, value) {
  switch (featureCode) {
    case FEATURE_CODES.POWER:
      return {
        EffectiveFlags: EFFECTIVE_FLAGS.POWER,
        Power: value === 1,
      };
    case FEATURE_CODES.MODE:
      return {
        EffectiveFlags: EFFECTIVE_FLAGS.OPERATION_MODE,
        OperationMode: MODES_GLADYS_TO_MELCLOUD[value],
      };
    case FEATURE_CODES.TEMPERATURE:
      return {
        EffectiveFlags: EFFECTIVE_FLAGS.SET_TEMPERATURE,
        SetTemperature: value,
      };
    default:
      return null;
  }
}
