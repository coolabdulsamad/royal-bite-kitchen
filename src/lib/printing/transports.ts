/**
 * Direct-printer transports. WebUSB and Web Bluetooth are runtime-detected:
 * Chrome/Edge (desktop + Android) support them; Firefox/Safari don't — callers
 * feature-check with the isSupported helpers and fall back to browser print.
 *
 * The same ESC/POS bytes can later be handed to a Capacitor native transport
 * (built-in printer on Android POS devices) without touching the encoder.
 */

export interface DirectPrinter {
  kind: "usb" | "ble";
  /** Human-readable name for the UI. */
  label: string;
  write(bytes: Uint8Array): Promise<void>;
  disconnect(): Promise<void>;
}

// ── Minimal ambient types (avoids extra @types deps) ───────────────────────
interface UsbEndpointLike {
  endpointNumber: number;
  direction: string;
  type: string;
}
interface UsbInterfaceLike {
  interfaceNumber: number;
  alternate: { endpoints: UsbEndpointLike[] };
}
interface UsbDeviceLike {
  productName?: string;
  configuration: { interfaces: UsbInterfaceLike[] } | null;
  open(): Promise<void>;
  close(): Promise<void>;
  selectConfiguration(n: number): Promise<void>;
  claimInterface(n: number): Promise<void>;
  releaseInterface(n: number): Promise<void>;
  transferOut(endpoint: number, data: BufferSource): Promise<unknown>;
}
interface UsbLike {
  requestDevice(options: { filters: unknown[] }): Promise<UsbDeviceLike>;
  getDevices(): Promise<UsbDeviceLike[]>;
}
interface BleCharacteristicLike {
  properties: { write: boolean; writeWithoutResponse: boolean };
  writeValue(data: BufferSource): Promise<void>;
  writeValueWithoutResponse(data: BufferSource): Promise<void>;
}
interface BleServiceLike {
  getCharacteristics(): Promise<BleCharacteristicLike[]>;
}
interface BleServerLike {
  connected: boolean;
  getPrimaryService(uuid: string | number): Promise<BleServiceLike>;
  disconnect(): void;
}
interface BleDeviceLike {
  name?: string;
  gatt?: { connect(): Promise<BleServerLike> };
}

function getWebUsb(): UsbLike | null {
  const nav = navigator as unknown as { usb?: UsbLike };
  return nav.usb ?? null;
}
function getWebBle(): {
  requestDevice(o: unknown): Promise<BleDeviceLike>;
} | null {
  const nav = navigator as unknown as {
    bluetooth?: { requestDevice(o: unknown): Promise<BleDeviceLike> };
  };
  return nav.bluetooth ?? null;
}

export function isWebUsbSupported(): boolean {
  return getWebUsb() !== null;
}
export function isWebBleSupported(): boolean {
  return getWebBle() !== null;
}

// ── WebUSB ─────────────────────────────────────────────────────────────────

const USB_CHUNK = 16 * 1024;

async function openUsbDevice(device: UsbDeviceLike): Promise<DirectPrinter> {
  await device.open();
  if (device.configuration === null) await device.selectConfiguration(1);

  const iface = device.configuration!.interfaces.find((i) =>
    i.alternate.endpoints.some((e) => e.direction === "out"),
  );
  if (!iface) {
    await device.close().catch(() => {});
    throw new Error("This USB device has no printable endpoint.");
  }
  await device.claimInterface(iface.interfaceNumber);
  const endpoint =
    iface.alternate.endpoints.find((e) => e.direction === "out" && e.type === "bulk") ??
    iface.alternate.endpoints.find((e) => e.direction === "out")!;

  return {
    kind: "usb",
    label: device.productName || "USB printer",
    async write(bytes: Uint8Array) {
      for (let offset = 0; offset < bytes.length; offset += USB_CHUNK) {
        await device.transferOut(
          endpoint.endpointNumber,
          bytes.slice(offset, offset + USB_CHUNK),
        );
      }
    },
    async disconnect() {
      await device.releaseInterface(iface.interfaceNumber).catch(() => {});
      await device.close().catch(() => {});
    },
  };
}

/** Ask the user to pick a USB printer (browser chooser). Must be a user gesture. */
export async function connectUsbPrinter(): Promise<DirectPrinter> {
  const usb = getWebUsb();
  if (!usb) throw new Error("USB printing is not supported in this browser.");
  // Printer class (0x07) covers most thermal printers; fall back to all devices.
  let device: UsbDeviceLike;
  try {
    device = await usb.requestDevice({ filters: [{ classCode: 0x07 }] });
  } catch (err) {
    if (err instanceof DOMException && err.name === "NotFoundError") {
      throw new Error("No printer selected.");
    }
    throw err;
  }
  return openUsbDevice(device);
}

/** Reconnect a previously granted USB printer without a picker (if present). */
export async function reconnectUsbPrinter(): Promise<DirectPrinter | null> {
  const usb = getWebUsb();
  if (!usb) return null;
  const devices = await usb.getDevices().catch(() => [] as UsbDeviceLike[]);
  if (devices.length === 0) return null;
  try {
    return await openUsbDevice(devices[0]);
  } catch {
    return null;
  }
}

// ── Web Bluetooth ──────────────────────────────────────────────────────────

/** Known BLE UART-style services used by common thermal printers. */
const BLE_PRINTER_SERVICES: Array<string | number> = [
  0xffe0, // very common (Goojprt / MTP / generic)
  0xffe5,
  0xff00,
  0x18f0,
  "0000ffe0-0000-1000-8000-00805f9b34fb",
  "000018f0-0000-1000-8000-00805f9b34fb",
  "49535343-fe7d-4ae5-8fa9-9fafd205e455", // ISSC transparent transmission
  "e7810a71-73ae-499d-8c15-faa9aef0c3f2", // common Chinese printer boards
  "0000ae00-0000-1000-8000-00805f9b34fb",
  "6e400001-b5a3-f393-e0a9-e50e24dcca9e", // Nordic UART
];

const BLE_CHUNK = 180; // safe MTU payload
const BLE_CHUNK_DELAY_MS = 20;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Ask the user to pick a Bluetooth printer (browser chooser, user gesture). */
export async function connectBlePrinter(): Promise<DirectPrinter> {
  const ble = getWebBle();
  if (!ble) throw new Error("Bluetooth printing is not supported in this browser.");

  let device: BleDeviceLike;
  try {
    device = await ble.requestDevice({
      acceptAllDevices: true,
      optionalServices: BLE_PRINTER_SERVICES,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "NotFoundError") {
      throw new Error("No printer selected.");
    }
    throw err;
  }
  if (!device.gatt) throw new Error("That device does not support printing (no GATT).");

  const server = await device.gatt.connect();

  // Find the first known service with a writable characteristic.
  let characteristic: BleCharacteristicLike | null = null;
  for (const uuid of BLE_PRINTER_SERVICES) {
    try {
      const service = await server.getPrimaryService(uuid);
      const chars = await service.getCharacteristics();
      characteristic =
        chars.find((c) => c.properties.writeWithoutResponse) ??
        chars.find((c) => c.properties.write) ??
        null;
      if (characteristic) break;
    } catch {
      // service not present on this device — try the next
    }
  }
  if (!characteristic) {
    server.disconnect();
    throw new Error("Connected, but this device has no printable channel.");
  }
  const ch = characteristic;

  return {
    kind: "ble",
    label: device.name || "Bluetooth printer",
    async write(bytes: Uint8Array) {
      if (!server.connected) throw new Error("Bluetooth printer disconnected.");
      for (let offset = 0; offset < bytes.length; offset += BLE_CHUNK) {
        const chunk = bytes.slice(offset, offset + BLE_CHUNK);
        if (ch.properties.writeWithoutResponse) {
          await ch.writeValueWithoutResponse(chunk);
        } else {
          await ch.writeValue(chunk);
        }
        await sleep(BLE_CHUNK_DELAY_MS);
      }
    },
    async disconnect() {
      if (server.connected) server.disconnect();
    },
  };
}
