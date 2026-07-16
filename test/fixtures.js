// Shared MELCloud API fixtures (shapes taken from the real MELCloud API).

export const AIR_TO_AIR_DEVICE = {
  DeviceID: 123,
  DeviceName: 'Living room AC',
  BuildingID: 456,
  MinTemperature: 16,
  MaxTemperature: 31,
  Device: {
    DeviceType: 0,
    Units: [{ Model: 'MSZ-AP25VGK' }],
  },
};

export const AIR_TO_WATER_DEVICE = {
  DeviceID: 789,
  DeviceName: 'Heat pump',
  BuildingID: 456,
  MinTemperature: 10,
  MaxTemperature: 30,
  Device: {
    DeviceType: 1,
    Units: [],
  },
};

// User/ListDevices response: devices spread across the structure, the floors,
// the floor areas and the root areas, to exercise the flattening.
export const LIST_DEVICES_RESPONSE = [
  {
    Structure: {
      Devices: [AIR_TO_AIR_DEVICE],
      Areas: [{ Devices: [] }],
      Floors: [
        {
          Devices: [],
          Areas: [{ Devices: [AIR_TO_WATER_DEVICE] }],
        },
      ],
    },
  },
];

// Device/Get response: OperationMode 1 is "heating" on MELCloud.
export const DEVICE_STATE = {
  DeviceID: 123,
  Power: true,
  OperationMode: 1,
  SetTemperature: 21,
  RoomTemperature: 19.5,
};
