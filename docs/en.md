# MELCloud

## Overview

This integration connects Gladys Assistant to **MELCloud**, the cloud service of
Mitsubishi Electric, to control your air conditioners from Gladys.

Once configured, every device of your MELCloud account appears in the Gladys
**Discovery** screen. Air-to-air units expose three controllable features:

- **Power** — turn the unit on or off;
- **Mode** — heating, drying, cooling, fan or auto;
- **Temperature** — the target temperature, within the min/max bounds of the unit.

Device states are refreshed every 10 seconds, so changes made from the
Mitsubishi remote control or the MELCloud app show up in Gladys shortly after.
Air-to-water and ventilation (Lossnay) units are listed but do not expose any
feature yet.

## Prerequisites

- A **MELCloud account** ([app.melcloud.com](https://app.melcloud.com)) with
  your air conditioners already registered in it: each unit needs a Mitsubishi
  Wi-Fi interface (e.g. MAC-567IF-E) paired with the MELCloud app.
- The units must be reachable from MELCloud: this integration talks to the
  Mitsubishi cloud, so your Gladys instance needs Internet access.

## Configuration

1. Install the integration from the Gladys store.
2. Open its **Configuration** screen and fill in:
   - **MELCloud email** — the email address of your MELCloud account;
   - **MELCloud password** — the password of that account (stored as a secret,
     never displayed back).
3. Save. The integration logs in to MELCloud and loads your devices.
4. Open the **Discovery** screen: your units are listed there. Add the ones you
   want, then place them in your rooms and dashboards like any Gladys device.

To use another MELCloud account later, just update the email and password in
the Configuration screen: the integration reconnects and refreshes the device
list automatically.

## Troubleshooting

- **"MELCloud is not configured" during discovery** — the email or password is
  missing: fill in both fields in the Configuration screen and save.
- **Login fails** — double-check your credentials by signing in at
  [app.melcloud.com](https://app.melcloud.com). If MELCloud asks you to accept
  new terms of use, accept them in the app and try again.
- **A unit is missing from Discovery** — make sure it is visible in the
  MELCloud app with the same account, then run the discovery again.
- **Commands seem ignored** — MELCloud can take a few seconds to push a command
  to the unit; the state in Gladys reflects the cloud state and catches up at
  the next 10-second poll. Also check that the unit is online in the MELCloud
  app (Wi-Fi adapter connected).
- **States stop updating** — the MELCloud session may have expired; the
  integration logs in again automatically. If the problem persists, check the
  integration logs from its configuration page in Gladys.
