const EASYLAP_VID = 0x10C4; // Silicon Labs
const EASYLAP_PID = 0x86B9; // CP2110 HID USB to UART Bridge
const PACKET_TIMER = 0x0B;
const PACKET_CAR = 0x0D;

let device;
let buffer = [];

// Convert bytes to uint32 from 4 bytes in little-endian
function readUint32LE(bytes, offset) {
  return bytes[offset] |
         (bytes[offset + 1] << 8) |
         (bytes[offset + 2] << 16) |
         (bytes[offset + 3] << 24);
}

// Handle a parsed EasyLAP packet
function handlePacket(callback) {
  while (buffer.length > 0) {
    const header = buffer[0];

    if (header === PACKET_TIMER) {
      if (buffer.length < 12) break; // wait for full packet
      if (buffer[2] !== 0x83) {
        buffer.shift();
        continue;
      }

      const timer = readUint32LE(buffer, 3);
      callback({ t: timer, c: null });
      buffer.splice(0, 12); // 0x0B + 1

    } else if (header === PACKET_CAR) {
      if (buffer.length < 14) break; // wait for full packet
      if (buffer[2] !== 0x84) {
        buffer.shift();
        continue;
      }

      const uid = buffer[3] | (buffer[4] << 8);
      const timer = readUint32LE(buffer, 7);
      callback({ t: timer, c: uid });
      buffer.splice(0, 14); // 0x0D + 1

    } else {
      buffer.shift(); // discard garbage
    }
  }
}

// Read loop
async function startListening(callback) {
  while (true) {
    try {
      const { data } = await device.receiveReport();
      if (data && data.buffer.byteLength > 0) {
        const bytes = Array.from(new Uint8Array(data.buffer));
        buffer.push(...bytes);
        handlePacket(callback);
      }
    } catch (err) {
      console.error("Error reading from device:", err);
      break;
    }

    await new Promise(res => setTimeout(res, 25));
  }
}

// Connect button handler
document.getElementById("connect").addEventListener("click", async () => {
  try {
    const devices = await navigator.hid.requestDevice({
      filters: [{ vendorId: EASYLAP_VID, productId: EASYLAP_PID }]
    });

    if (devices.length === 0) {
      alert("Device not selected.");
      return;
    }

    device = devices[0];
    await device.open();
    console.log("Connected to EasyLAP");

    startListening(({ t, c }) => {
      if (c === null) {
        console.log("Timer:", t);
      } else {
        console.log("Car", c, "at", t);
      }
    });

  } catch (err) {
    console.error("Failed to connect:", err);
  }
});
