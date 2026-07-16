// -----------------------------------------------------------------------------
// Standard Gladys device-feature constants + MELCloud protocol constants.
//
// The Gladys values are the canonical category / type strings understood by
// Gladys (reference: server/utils/constants.js in the Gladys repository).
// -----------------------------------------------------------------------------

export const CATEGORY = {
  AIR_CONDITIONING: 'air-conditioning',
};

export const TYPE = {
  BINARY: 'binary',
  MODE: 'mode',
  TARGET_TEMPERATURE: 'target-temperature',
};

// Gladys air-conditioning modes (server/utils/constants.js: AC_MODE).
export const AC_MODE = {
  AUTO: 0,
  COOLING: 1,
  HEATING: 2,
  DRYING: 3,
  FAN: 4,
};

// Devices are polled every 10 seconds, like the built-in MELCloud service
// (must be one of the Gladys DEVICE_POLL_FREQUENCIES values, in milliseconds).
export const POLL_FREQUENCY = 10 * 1000;

// MELCloud cloud API. The env var override is only used by the test suite.
export const MELCLOUD_ENDPOINT = (
  process.env.MELCLOUD_ENDPOINT || 'https://app.melcloud.com/Mitsubishi.Wifi.Client'
).replace(/\/+$/, '');

// MELCloud device types found in User/ListDevices.
export const MELCLOUD_DEVICE_TYPES = {
  AIR_TO_AIR: 0,
  AIR_TO_WATER: 1,
  ENERGY_RECOVERY_VENTILATION: 3,
};

// Bitmask telling MELCloud which properties of a Device/SetAta payload changed.
export const EFFECTIVE_FLAGS = {
  POWER: 1,
  OPERATION_MODE: 6,
  SET_TEMPERATURE: 4,
};

// Feature suffixes used in the feature external ids
// (`ext:<selector>:<deviceId>:<code>`).
export const FEATURE_CODES = {
  POWER: 'power',
  MODE: 'mode',
  TEMPERATURE: 'temperature',
};
