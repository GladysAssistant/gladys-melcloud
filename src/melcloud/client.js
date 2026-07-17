// -----------------------------------------------------------------------------
// Minimal MELCloud cloud API client (uses the Node.js built-in fetch).
//
// The MELCloud API is the same one used by the official mobile application:
//   - POST Login/ClientLogin      -> returns a session ContextKey
//   - GET  User/ListDevices       -> houses / floors / areas / devices tree
//   - GET  Device/Get             -> full state of one device
//   - POST Device/SetAta          -> write the state of an air-to-air device
//
// Every authenticated request carries the ContextKey in the X-MitsContextKey
// header. When MELCloud invalidates the session (HTTP 401), the client logs in
// again once with the stored credentials and retries the request.
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';

import { MELCLOUD_ENDPOINT } from '../constants.js';

const logger = createLogger({ name: 'melcloud' });

const REQUEST_TIMEOUT_MS = 5000;

const DEFAULT_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64; rv:73.0) ',
  Accept: 'application/json, text/javascript, */*; q=0.01',
  'Accept-Language': 'en-US,en;q=0.5',
  'X-Requested-With': 'XMLHttpRequest',
  Cookie: 'policyaccepted=true',
};

export class MELCloudClient {
  constructor(baseUrl = MELCLOUD_ENDPOINT) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.contextKey = null;
    this.credentials = null;
  }

  isLoggedIn() {
    return this.contextKey !== null;
  }

  /**
   * Log in to MELCloud and store the session ContextKey.
   * @param {string} username MELCloud account email
   * @param {string} password MELCloud account password
   */
  async login(username, password) {
    this.contextKey = null;
    this.credentials = { username, password };
    logger.debug('Logging in...');
    const response = await this.#fetchJson('Login/ClientLogin', {
      method: 'POST',
      headers: { ...DEFAULT_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        Email: username,
        Password: password,
        Language: 0,
        AppVersion: '1.19.1.1',
        Persist: true,
        CaptchaResponse: null,
      }),
    });
    if (response.ErrorId) {
      throw new Error(
        `MELCloud login failed: ${response.ErrorMessage || `error ${response.ErrorId}`}`,
      );
    }
    this.contextKey = response.LoginData.ContextKey;
    logger.info('Logged in');
  }

  logout() {
    this.contextKey = null;
    this.credentials = null;
  }

  /**
   * List all MELCloud devices of the account, flattened from the
   * houses / floors / areas tree returned by User/ListDevices.
   * @returns {Promise<Array>} MELCloud device entries
   */
  async listDevices() {
    const houses = await this.#authenticatedRequest('User/ListDevices');

    const devices = [];
    houses.forEach((house) => {
      devices.push(...house.Structure.Devices);
      house.Structure.Areas.forEach((area) => devices.push(...area.Devices));
      house.Structure.Floors.forEach((floor) => {
        devices.push(...floor.Devices);
        floor.Areas.forEach((area) => devices.push(...area.Devices));
      });
    });

    logger.debug(`${devices.length} devices loaded`);
    return devices;
  }

  /**
   * Fetch the full current state of one device.
   * @param {string|number} deviceId MELCloud DeviceID
   * @param {string|number} buildingId MELCloud BuildingID
   */
  async getDevice(deviceId, buildingId) {
    const query = new URLSearchParams({ id: String(deviceId), buildingID: String(buildingId) });
    return this.#authenticatedRequest(`Device/Get?${query}`);
  }

  /**
   * Write the state of an air-to-air device. `state` is the full object
   * returned by Device/Get, merged with the changed properties and their
   * EffectiveFlags.
   * @param {object} state full device state to send
   */
  async setDeviceState(state) {
    return this.#authenticatedRequest('Device/SetAta', {
      method: 'POST',
      body: JSON.stringify(state),
      contentType: 'application/json',
    });
  }

  /**
   * Perform an authenticated request; on a 401, log in again once with the
   * stored credentials and retry.
   */
  async #authenticatedRequest(path, { method = 'GET', body, contentType } = {}) {
    if (!this.isLoggedIn()) {
      throw new Error('MELCloud is not connected');
    }
    const doRequest = () =>
      this.#fetchJson(path, {
        method,
        body,
        headers: {
          ...DEFAULT_HEADERS,
          ...(contentType ? { 'Content-Type': contentType } : {}),
          'X-MitsContextKey': this.contextKey,
        },
      });
    try {
      return await doRequest();
    } catch (e) {
      if (e.status === 401 && this.credentials) {
        logger.warn('Session expired, logging in again...');
        await this.login(this.credentials.username, this.credentials.password);
        return doRequest();
      }
      throw e;
    }
  }

  async #fetchJson(path, { method, headers, body }) {
    const response = await fetch(`${this.baseUrl}/${path}`, {
      method,
      headers,
      body,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) {
      const error = new Error(
        `MELCloud request failed: ${method} ${path} -> HTTP ${response.status}`,
      );
      error.status = response.status;
      throw error;
    }
    return response.json();
  }
}
