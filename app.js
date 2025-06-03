document.getElementById('connect').addEventListener('click', async () => {
  const filters = [
    {
      vendorId: 0x10c4, // Replace with EasyLAP's vendor ID
      productId: 0x86b9 // Replace with EasyLAP's product ID
    }
  ];

  try {
    const devices = await navigator.hid.requestDevice({ filters });
    if (devices.length === 0) return;

    const device = devices[0];
    await device.open();

    device.addEventListener('inputreport', event => {
      const { data, reportId } = event;
      // Parse the data buffer to extract lap timing information
      const lapTime = parseLapTime(data);
      displayLapTime(lapTime);
    });

    // Send any necessary initialization commands to the device here
    // await device.sendReport(reportId, data);
  } catch (error) {
    console.error('Error:', error);
  }
});

function parseLapTime(dataView) {
  // Implement parsing logic based on EasyLAP's data format
  // This is a placeholder implementation
  const lapTime = dataView.getUint16(0, true); // Example: read 2 bytes as lap time
  return lapTime;
}

function displayLapTime(lapTime) {
  const lapTimesDiv = document.getElementById('lap-times');
  const timeElement = document.createElement('div');
  timeElement.textContent = `Lap Time: ${lapTime} ms`;
  lapTimesDiv.appendChild(timeElement);
}
