const lapTimesDiv = document.getElementById("lap-times");

let device = null;
let buffer = [];

document.getElementById("connect").addEventListener("click", async () => {
  const filters = [{ vendorId: 0x10C4, productId: 0x86B9 }]; // CP2110 + EasyLAP

  try {
    const devices = await navigator.hid.requestDevice({ filters });
    if (devices.length === 0) return;

    device = devices[0];
    await device.open();

    // Configure UART settings
    await configureUART(device);

    device.addEventListener("inputreport", handleInputReport);

    console.log("Connected to EasyLAP");
    lapTimesDiv.innerHTML = "<p>Connected. Waiting for lap data...</p>";
  } catch (error) {
    console.error("Connection failed:", error);
  }
});

async function configureUART(device) {
  // CP2110 UART configuration parameters
  const baudRate = 38400;
  const baudRateBytes = new Uint8Array([
    baudRate & 0xFF,
    (baudRate >> 8) & 0xFF,
    (baudRate >> 16) & 0xFF,
    (baudRate >> 24) & 0xFF,
  ]);

  // UART configuration bytes
  const config = new Uint8Array([
    0x50,             // Report ID for Set UART Config
    ...baudRateBytes, // Baud rate (LSB first)
    0x08,             // Data bits: 8
    0x00,             // Parity: None
    0x00,             // Stop bits: 1
    0x00,             // Flow control: None
    0x00,             // Reserved
    0x00,             // Reserved
    0x00,             // Reserved
    0x00,             // Reserved
  ]);

  try {
    await device.sendFeatureReport(0x50, config.slice(1));
    console.log("UART configuration sent.");
  } catch (error) {
    console.error("Failed to send UART configuration:", error);
  }
}

function handleInputReport(event) {
  const data = new Uint8Array(event.data.buffer);
  buffer.push(...data);

  // Try to parse packets
  while (buffer.length > 0) {
    if (buffer[0] === 0x0B && buffer.length >= 11) {
      // Timer packet (11 bytes)
      if (buffer[2] !== 0x83) {
        buffer.shift(); // discard garbage
        continue;
      }
      const t =
        buffer[3] |
        (buffer[4] << 8) |
        (buffer[5] << 16) |
        (buffer[6] << 24);
      displayTimer(t, null);
      buffer = buffer.slice(12); // 0x0B + 11
    } else if (buffer[0] === 0x0D && buffer.length >= 13) {
      // Car packet (13 bytes)
      if (buffer[2] !== 0x84) {
        buffer.shift(); // discard garbage
        continue;
      }
      const carId = buffer[3] | (buffer[4] << 8);
      const t =
        buffer[7] |
        (buffer[8] << 8) |
        (buffer[9] << 16) |
        (buffer[10] << 24);
      displayTimer(t, carId);
      buffer = buffer.slice(14); // 0x0D + 13
    } else {
      buffer.shift(); // discard unrecognized byte
    }
  }
}

function displayTimer(timer, carId) {
  const div = document.createElement("div");
  const seconds = (timer / 1000).toFixed(3);
  const content = carId !== null
    ? `Car ${carId} - Lap: ${seconds}s`
    : `System Timer: ${seconds}s`;
  div.textContent = content;
  lapTimesDiv.appendChild(div);
}
