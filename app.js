const lapTimesDiv = document.getElementById("lap-times");

let device = null;
let buffer = [];
const lastLapTimeByCar = new Map();

document.getElementById("connect").addEventListener("click", async () => {
  const filters = [{ vendorId: 0x10C4, productId: 0x86B9 }]; // EasyLAP CP2110

  try {
    const devices = await navigator.hid.requestDevice({ filters });
    if (devices.length === 0) return;

    device = devices[0];
    await device.open();

    // Send UART config feature report
    await configureUART(device);

    device.addEventListener("inputreport", handleInputReport);

    console.log("✅ Connected to EasyLAP.");
    lapTimesDiv.innerHTML = "<p>Connected. Waiting for lap data...</p>";
  } catch (error) {
    console.error("❌ Connection failed:", error);
  }
});

async function configureUART(device) {
  const baudRate = 38400;
  const baudBytes = new Uint8Array([
    baudRate & 0xFF,
    (baudRate >> 8) & 0xFF,
    (baudRate >> 16) & 0xFF,
    (baudRate >> 24) & 0xFF
  ]);

  const config = new Uint8Array([
    0x50,             // Report ID: Set UART Config
    ...baudBytes,     // 4 bytes: Baud rate
    0x08,             // Data bits: 8
    0x00,             // Parity: None
    0x00,             // Stop bits: 1
    0x00,             // Flow control: None
    0x00, 0x00, 0x00, 0x00 // Reserved
  ]);

  const enable = new Uint8Array([
    0x41, 0x01 // Report ID 0x41: Set UART Enable, Enable = 1
  ]);

  try {
    await device.sendFeatureReport(0x50, config.slice(1));
    console.log("✅ UART config sent");

    await device.sendFeatureReport(0x41, enable.slice(1));
    console.log("✅ UART enabled");
  } catch (error) {
    console.error("❌ UART setup failed:", error);
  }
}

function handleInputReport(event) {
  const data = new Uint8Array(event.data.buffer);

  // Uncomment to debug:
  console.log("📥 Received:", Array.from(data).map(x => x.toString(16).padStart(2, "0")).join(" "));

  buffer.push(...data);

  while (buffer.length > 0) {
    if (buffer[0] === 0x0B && buffer.length >= 12) {
      // Timer packet (System timer)
      if (buffer[2] !== 0x83) {
        buffer.shift();
        continue;
      }
      const timer =
        buffer[3] |
        (buffer[4] << 8) |
        (buffer[5] << 16) |
        (buffer[6] << 24);
      displayTimer(timer, null);
      buffer = buffer.slice(12);
    } else if (buffer[0] === 0x0D && buffer.length >= 14) {
      // Car packet (Lap time)
      if (buffer[2] !== 0x84) {
        buffer.shift();
        continue;
      }
      const carId = buffer[3] | (buffer[4] << 8);
      const timer =
        buffer[7] |
        (buffer[8] << 8) |
        (buffer[9] << 16) |
        (buffer[10] << 24);

      // 🧠 Check for duplicate
      if (lastLapTimeByCar.get(carId) !== timer) {
        lastLapTimeByCar.set(carId, timer);
        displayTimer(timer, carId);
      }

      buffer = buffer.slice(14);
    } else {
      buffer.shift(); // discard unrecognized
    }
  }
}

function displayTimer(timer, carId) {
  const div = document.createElement("div");
  const seconds = (timer / 1000).toFixed(3);
  div.textContent = carId !== null
    ? `🚗 Car ${carId} - Lap: ${seconds}s`
    : `⏱️ System Timer: ${seconds}s`;

  // Prepend the lap time at the top
  lapTimesDiv.insertBefore(div, lapTimesDiv.firstChild);
}
