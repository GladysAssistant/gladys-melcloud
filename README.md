# Gladys MELCloud integration

External integration for [Gladys Assistant](https://gladysassistant.com) that
controls **Mitsubishi Electric air conditioners** through the
[MELCloud](https://app.melcloud.com) cloud service.

Built from the official
[`integration-template-js`](https://github.com/GladysAssistant/integration-template-js)
template with the JavaScript SDK
[`@gladysassistant/integration-sdk`](https://github.com/GladysAssistant/integration-sdk-js),
it reproduces the behaviour of the built-in Gladys MELCloud service.

## What it does

- Logs in to MELCloud with the email / password filled in the integration
  settings (the password is a `secret` config field, never sent back to the
  frontend).
- Lists every device of the MELCloud account (houses, floors and areas are
  flattened) and publishes them as **discovered devices**: the user creates
  them from the Gladys Discovery screen.
- **Air-to-air units** (`DeviceType 0`) expose three features:

  | Feature | Category / type | Mapping |
  |---------|-----------------|---------|
  | Power | `air-conditioning` / `binary` | MELCloud `Power` |
  | Mode | `air-conditioning` / `mode` | MELCloud `OperationMode` (heat / dry / cool / fan / auto) |
  | Temperature | `air-conditioning` / `target-temperature` | MELCloud `SetTemperature`, bounded by the unit min/max |

  Air-to-water and ventilation units are listed without features (not
  supported yet, like in the built-in service).

- Devices are **polled every 10 seconds** (`Device/Get`) and the states are
  pushed back to Gladys.
- User commands read the full current state, merge the change with the right
  `EffectiveFlags`, and write it back with `Device/SetAta`.
- The MELCloud `BuildingID` is stored as a device param: Gladys sends the
  params back with every poll / set-value command.
- When the MELCloud session expires (HTTP 401), the client logs in again once
  and retries the request.

## Project structure

```
.
├─ index.js                          # SDK bootstrap + event wiring
├─ src/
│  ├─ melcloud/client.js             # MELCloud cloud API client (fetch)
│  ├─ devices/convertDevice.js       # MELCloud device -> Gladys discovery payload
│  ├─ devices/airToAir.js            # air-to-air features + value mappings
│  ├─ constants.js                   # MELCloud constants (+ AC modes, poll frequency)
│  └─ config.js                      # config defaults + normalization
├─ test/                             # node:test unit + end-to-end tests
├─ gladys-assistant-integration.json # manifest (name, config schema, image…)
├─ Dockerfile                        # Node 24 Alpine, read-only rootfs ready
└─ .github/workflows/build.yml       # multi-arch build on git tag
```

The common plumbing comes straight from the SDK (v0.2.0+): the leveled
`logger` / `createLogger({ name })` (driven by the `LOG_LEVEL` env var), the
standard Gladys `DEVICE_FEATURE_CATEGORIES` / `DEVICE_FEATURE_TYPES`
constants, and `gladys.handleShutdown()` for the graceful SIGTERM/SIGINT
handling.

## Run it locally

```bash
npm install
GLADYS_HOST_API_URL="http://localhost:1443" \
GLADYS_INTEGRATION_TOKEN="<token>" \
GLADYS_INTEGRATION_SELECTOR="melcloud" \
LOG_LEVEL=debug \
npm start
```

The three `GLADYS_*` variables are injected by the Gladys supervisor when the
integration runs inside its sandboxed container. The SDK reads them
automatically.

## Tests

```bash
npm test
```

The test suite needs no network and no MELCloud account: unit tests cover the
device conversion and value mappings, and an end-to-end test boots the real
integration process against a fake Gladys host (WebSocket + REST) and a fake
MELCloud API, then exercises discovery, polling and commands.

## License

Apache-2.0
