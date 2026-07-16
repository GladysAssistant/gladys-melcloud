// -----------------------------------------------------------------------------
// Entry point of the Gladys MELCloud external integration.
//
// Reproduces the built-in Gladys MELCloud service as an external integration:
//   - logs in to MELCloud with the credentials from the integration config;
//   - publishes the account devices as discovered devices (air-to-air units
//     expose power / mode / target-temperature features);
//   - answers the 10-second polls of Gladys with the current device state;
//   - forwards user commands to MELCloud (Device/SetAta).
//
// Environment variables provided by the Gladys supervisor to the container:
//   - GLADYS_HOST_API_URL         (host API URL)
//   - GLADYS_INTEGRATION_TOKEN    (integration-scoped JWT)
//   - GLADYS_INTEGRATION_SELECTOR (integration identifier)
// The SDK reads them automatically: `new GladysIntegration()` is enough.
// -----------------------------------------------------------------------------

import { GladysIntegration, logger } from '@gladysassistant/integration-sdk';
import { normalizeConfig } from './src/config.js';
import { MELCloudClient } from './src/melcloud/client.js';
import { convertDevice, getBuildingId } from './src/devices/convertDevice.js';
import { buildPollStates, buildSetAtaChanges } from './src/devices/airToAir.js';

const gladys = new GladysIntegration();
const melcloud = new MELCloudClient();

// Current configuration (hot-reloaded via onConfigUpdated).
let config = normalizeConfig();

/**
 * Extract the MELCloud DeviceID from a device external id
 * (`ext:<selector>:<DeviceID>`).
 */
function parseDeviceId(externalId) {
  const prefix = gladys.externalId('');
  if (!externalId || !externalId.startsWith(prefix)) {
    throw new Error(`MELCloud device external_id is invalid: "${externalId}" should start with "${prefix}"`);
  }
  const deviceId = externalId.slice(prefix.length);
  if (deviceId.length === 0) {
    throw new Error(`MELCloud device external_id is invalid: "${externalId}" has no device id`);
  }
  return deviceId;
}

/**
 * Log in to MELCloud with the current config. Returns false (without
 * throwing) when the credentials are not filled in yet.
 */
async function connectToMELCloud() {
  if (!config.username || !config.password) {
    melcloud.logout();
    logger.warn('MELCloud is not configured yet: fill in the email and password in the integration settings');
    return false;
  }
  await melcloud.login(config.username, config.password);
  return true;
}

/**
 * Load the devices from MELCloud and publish them as discovered devices.
 */
async function publishDevices() {
  const melCloudDevices = await melcloud.listDevices();
  logger.info(`${melCloudDevices.length} MELCloud devices found`);
  await gladys.publishDiscoveredDevices(melCloudDevices.map((device) => convertDevice(gladys, device)));
}

// --- Discovery: Gladys asks for the list of devices --------------------------
gladys.onScanRequest(async () => {
  logger.info('onScanRequest -> loading MELCloud devices');
  if (!melcloud.isLoggedIn() && !(await connectToMELCloud())) {
    throw new Error('MELCloud is not configured');
  }
  await publishDevices();
});

// --- Command: the user acts on a controllable feature ------------------------
gladys.onSetValue(async (device, feature, value) => {
  logger.info(`onSetValue <- ${feature.external_id} = ${value}`);
  const deviceId = parseDeviceId(device.external_id);
  const buildingId = getBuildingId(device);
  const featureCode = feature.external_id.split(':').pop();

  const changes = buildSetAtaChanges(featureCode, value);
  if (!changes) {
    throw new Error(`MELCloud feature "${feature.external_id}" is not controllable`);
  }

  // MELCloud expects the FULL device state back, with EffectiveFlags marking
  // what changed: read the current state, merge, write.
  const currentState = await melcloud.getDevice(deviceId, buildingId);
  await melcloud.setDeviceState({
    ...currentState,
    ...changes,
    HasPendingCommand: true,
  });
});

// --- Polling: Gladys asks to refresh a device (every 10 seconds) -------------
gladys.onPoll(async (device) => {
  const deviceId = parseDeviceId(device.external_id);
  const buildingId = getBuildingId(device);

  const melCloudState = await melcloud.getDevice(deviceId, buildingId);
  const states = buildPollStates(device.external_id, melCloudState);
  if (states.length > 0) {
    await gladys.publishStates(states);
  }
});

// --- Configuration updated by the user ---------------------------------------
gladys.onConfigUpdated(async (newConfig) => {
  logger.info('onConfigUpdated -> reconnecting to MELCloud');
  config = normalizeConfig(newConfig);
  try {
    if (await connectToMELCloud()) {
      await publishDevices();
    }
  } catch (err) {
    logger.error('Reconnection to MELCloud failed', err);
  }
});

// --- Connection lifecycle ----------------------------------------------------
gladys.on('connected', async () => {
  logger.info('WebSocket connected to Gladys');
  try {
    // 1) Fetch the config filled in by the user.
    config = normalizeConfig(await gladys.getConfig());

    // 2) Log in to MELCloud and publish the devices.
    if (await connectToMELCloud()) {
      await publishDevices();
    }
  } catch (err) {
    logger.error('Post-connection initialization failed', err);
  }
});

gladys.on('disconnected', () => {
  logger.warn('WebSocket disconnected - the SDK will try to reconnect');
});

// --- Graceful shutdown -------------------------------------------------------
// The SDK disconnects cleanly and exits with code 0 when the supervisor stops
// the container (SIGTERM/SIGINT).
gladys.handleShutdown((signal) => {
  logger.info(`Received ${signal} -> graceful shutdown`);
});

// --- Startup -----------------------------------------------------------------
logger.info('Starting the MELCloud integration...');
gladys.connect().catch((err) => {
  logger.error('Initial connection failed', err);
  process.exit(1);
});
