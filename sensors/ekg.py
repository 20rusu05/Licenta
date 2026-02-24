"""
Citire senzor ECG AD8232 via ADC MCP3008.

Conexiuni hardware:
  AD8232 → MCP3008 → Raspberry Pi 5
  
  AD8232:
    - GND → GND
    - 3.3V → 3.3V
    - OUTPUT → MCP3008 CH0
    - LO+ → GPIO 17
    - LO- → GPIO 27

  MCP3008 (ADC):
    - VDD → 3.3V
    - VREF → 3.3V
    - AGND → GND
    - DGND → GND
    - CLK → GPIO 11 (SPI0 SCLK)
    - DOUT → GPIO 9 (SPI0 MISO)
    - DIN → GPIO 10 (SPI0 MOSI)
    - CS → GPIO 8 (SPI0 CE0)
    - CH0 → AD8232 OUTPUT
"""

import time
import signal
import sys

# Încercare import biblioteci hardware (funcționează doar pe RPi)
try:
    import spidev
    import RPi.GPIO as GPIO
    HARDWARE_AVAILABLE = True
except ImportError:
    HARDWARE_AVAILABLE = False
    print("[ECG] Biblioteci hardware indisponibile - mod simulare activat")

from sensor_client import SensorClient
from config import INTERVALS, PINS, ADC, BATCH_SIZE


class ECGSensor:
    """Citire senzor ECG AD8232 prin ADC MCP3008."""

    def __init__(self):
        self.client = SensorClient("ecg")
        self.running = False
        self.batch = []

        if HARDWARE_AVAILABLE:
            # Setup GPIO pentru LO+/LO-
            GPIO.setmode(GPIO.BCM)
            GPIO.setup(PINS["ecg_lo_plus"], GPIO.IN)
            GPIO.setup(PINS["ecg_lo_minus"], GPIO.IN)

            # Setup SPI pentru MCP3008
            self.spi = spidev.SpiDev()
            self.spi.open(ADC["spi_port"], ADC["spi_device"])
            self.spi.max_speed_hz = 1350000

    def read_adc(self, channel):
        """Citire canal ADC MCP3008 (0-1023)."""
        if not HARDWARE_AVAILABLE:
            # Simulare: generează semnal ECG sintetic
            import math
            import random
            t = time.time()
            # Simulare PQRST waveform
            heart_rate = 72  # BPM
            period = 60.0 / heart_rate
            phase = (t % period) / period

            # Forma de undă ECG simplificată
            if 0.0 <= phase < 0.05:      # P wave
                value = 512 + 30 * math.sin(phase / 0.05 * math.pi)
            elif 0.15 <= phase < 0.18:    # Q wave
                value = 512 - 40 * math.sin((phase - 0.15) / 0.03 * math.pi)
            elif 0.18 <= phase < 0.22:    # R wave (peak)
                value = 512 + 350 * math.sin((phase - 0.18) / 0.04 * math.pi)
            elif 0.22 <= phase < 0.26:    # S wave
                value = 512 - 60 * math.sin((phase - 0.22) / 0.04 * math.pi)
            elif 0.30 <= phase < 0.45:    # T wave
                value = 512 + 50 * math.sin((phase - 0.30) / 0.15 * math.pi)
            else:
                value = 512

            # Adaugă zgomot
            value += random.gauss(0, 5)
            return max(0, min(1023, int(value)))

        # Citire reală MCP3008
        adc = self.spi.xfer2([1, (8 + channel) << 4, 0])
        value = ((adc[1] & 3) << 8) + adc[2]
        return value

    def check_leads(self):
        """Verifică dacă electrozii sunt conectați."""
        if not HARDWARE_AVAILABLE:
            return True

        lo_plus = GPIO.input(PINS["ecg_lo_plus"])
        lo_minus = GPIO.input(PINS["ecg_lo_minus"])

        # Dacă LO+ sau LO- sunt HIGH, electrozii nu sunt atașați
        return lo_plus == 0 and lo_minus == 0

    def start(self, pacient_id=None):
        """Pornește citirea ECG."""
        self.running = True
        self.client.connect_to_server()

        print("[ECG] Citire pornită. CTRL+C pentru oprire.")

        while self.running:
            try:
                if self.check_leads():
                    value = self.read_adc(ADC["ecg_channel"])
                    # Conversie la mV (0-3.3V, 10-bit ADC)
                    voltage_mv = (value / 1023.0) * 3300.0

                    self.batch.append({
                        "value": voltage_mv,
                        "timestamp": time.time(),
                        "leads_ok": True,
                    })

                    if len(self.batch) >= BATCH_SIZE["ecg"]:
                        self.client.send_batch(self.batch, pacient_id)
                        self.batch = []
                else:
                    # Electrozii nu sunt conectați
                    self.client.send_reading(
                        value_1=0,
                        value_2=None,
                        pacient_id=pacient_id
                    )
                    print("[ECG] ⚠ Electrozi deconectați!")

                time.sleep(INTERVALS["ecg"])

            except KeyboardInterrupt:
                break
            except Exception as e:
                print(f"[ECG] Eroare: {e}")
                time.sleep(1)

        self.stop()

    def stop(self):
        """Oprește citirea ECG."""
        self.running = False
        if HARDWARE_AVAILABLE:
            self.spi.close()
            GPIO.cleanup()
        self.client.disconnect_from_server()
        print("[ECG] Oprit.")


def main():
    import argparse
    parser = argparse.ArgumentParser(description="Citire senzor ECG AD8232")
    parser.add_argument("--pacient", type=int, help="ID-ul pacientului monitorizat")
    args = parser.parse_args()

    sensor = ECGSensor()

    def signal_handler(sig, frame):
        sensor.stop()
        sys.exit(0)

    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)

    sensor.start(pacient_id=args.pacient)


if __name__ == "__main__":
    main()
