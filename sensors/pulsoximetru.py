"""
Citire senzor pulsoximetru MAX30102.
Măsoară: puls (BPM) și saturație oxigen (SpO2%).

Conexiuni hardware:
  MAX30102 → Raspberry Pi 5
  - VIN → 3.3V
  - GND → GND
  - SDA → GPIO 2 (I2C1 SDA)
  - SCL → GPIO 3 (I2C1 SCL)
  - INT → GPIO 22 (opțional, pentru întreruperi)
"""

import time
import signal
import sys

# Încercare import biblioteci hardware
try:
    import smbus2
    import os
    HARDWARE_AVAILABLE = os.path.exists(f"/dev/i2c-{1}")
    if not HARDWARE_AVAILABLE:
        print("[PULSOXIMETRU] I2C bus /dev/i2c-1 indisponibil - mod simulare activat")
        print("  Soluție: sudo reboot (dacă i2c_arm e activat în config.txt)")
except ImportError:
    HARDWARE_AVAILABLE = False
    print("[PULSOXIMETRU] Biblioteci hardware indisponibile - mod simulare activat")

from sensor_client import SensorClient
from config import INTERVALS, I2C


# Registre MAX30102
REG_INTR_STATUS_1 = 0x00
REG_INTR_ENABLE_1 = 0x02
REG_FIFO_WR_PTR = 0x04
REG_OVF_COUNTER = 0x05
REG_FIFO_RD_PTR = 0x06
REG_FIFO_DATA = 0x07
REG_MODE_CONFIG = 0x09
REG_SPO2_CONFIG = 0x0A
REG_LED1_PA = 0x0C  # RED LED
REG_LED2_PA = 0x0D  # IR LED
REG_TEMP_INT = 0x1F
REG_TEMP_FRAC = 0x20
REG_TEMP_CONFIG = 0x21


class PulsOximeter:
    """Citire senzor pulsoximetru MAX30102."""

    def __init__(self):
        self.client = SensorClient("pulsoximetru")
        self.running = False
        self.address = I2C["max30102_addr"]

        if HARDWARE_AVAILABLE:
            self.bus = smbus2.SMBus(I2C["bus"])
            self._init_sensor()

        # Variabile pentru calcul BPM
        self.ir_buffer = []
        self.red_buffer = []
        self.buffer_size = 100

    def _init_sensor(self):
        """Inițializare senzor MAX30102."""
        # Reset
        self.bus.write_byte_data(self.address, REG_MODE_CONFIG, 0x40)
        time.sleep(0.1)

        # Interrupt enable
        self.bus.write_byte_data(self.address, REG_INTR_ENABLE_1, 0xC0)

        # FIFO config
        self.bus.write_byte_data(self.address, REG_FIFO_WR_PTR, 0x00)
        self.bus.write_byte_data(self.address, REG_OVF_COUNTER, 0x00)
        self.bus.write_byte_data(self.address, REG_FIFO_RD_PTR, 0x00)

        # SpO2 mode, ADC range 4096, sample rate 100, pulse width 411
        self.bus.write_byte_data(self.address, REG_SPO2_CONFIG, 0x27)

        # LED pulse amplitude
        self.bus.write_byte_data(self.address, REG_LED1_PA, 0x24)  # RED
        self.bus.write_byte_data(self.address, REG_LED2_PA, 0x24)  # IR

        # SpO2 mode
        self.bus.write_byte_data(self.address, REG_MODE_CONFIG, 0x03)

    def _read_fifo(self):
        """Citire date din FIFO."""
        # Citire status întrerupere pentru a debloca FIFO
        self.bus.read_byte_data(self.address, REG_INTR_STATUS_1)

        # Citire 6 octeți din FIFO (3 RED + 3 IR)
        data = self.bus.read_i2c_block_data(self.address, REG_FIFO_DATA, 6)

        red = ((data[0] & 0x03) << 16) | (data[1] << 8) | data[2]
        ir = ((data[3] & 0x03) << 16) | (data[4] << 8) | data[5]

        return red, ir

    def _calculate_hr_spo2(self):
        """Calcul simplu heart rate și SpO2 din buffer."""
        if len(self.ir_buffer) < 50:
            return None, None

        # Calcul heart rate prin detectare peak-uri
        ir_data = self.ir_buffer[-100:]
        mean_ir = sum(ir_data) / len(ir_data)

        # Detectare zero-crossings peste medie
        crossings = 0
        above = ir_data[0] > mean_ir
        for val in ir_data[1:]:
            now_above = val > mean_ir
            if now_above and not above:
                crossings += 1
            above = now_above

        # Estimare BPM (crossings în buffer_size samples la 100Hz)
        duration_sec = len(ir_data) / 100.0
        heart_rate = (crossings / duration_sec) * 60.0
        heart_rate = max(40, min(200, heart_rate))  # Limitare rezonabilă

        # Calcul SpO2 simplificat (raport R/IR)
        red_data = self.red_buffer[-100:]
        red_ac = max(red_data) - min(red_data)
        red_dc = sum(red_data) / len(red_data)
        ir_ac = max(ir_data) - min(ir_data)
        ir_dc = sum(ir_data) / len(ir_data)

        if ir_dc > 0 and red_dc > 0 and ir_ac > 0:
            ratio = (red_ac / red_dc) / (ir_ac / ir_dc)
            # Formula empirică SpO2
            spo2 = 110.0 - 25.0 * ratio
            spo2 = max(70, min(100, spo2))
        else:
            spo2 = None

        return heart_rate, spo2

    def _simulate_reading(self):
        """Generează date simulate pentru testare."""
        import random
        import math

        t = time.time()
        # Simulare heart rate cu variație
        base_hr = 75
        hr = base_hr + 5 * math.sin(t * 0.1) + random.gauss(0, 1)
        hr = max(55, min(110, hr))

        # Simulare SpO2
        base_spo2 = 97.5
        spo2 = base_spo2 + random.gauss(0, 0.5)
        spo2 = max(92, min(100, spo2))

        return round(hr, 1), round(spo2, 1)

    def start(self, pacient_id=None):
        """Pornește citirea pulsoximetrului."""
        self.running = True
        self.client.connect_to_server()

        print("[PULSOXIMETRU] Citire pornită. CTRL+C pentru oprire.")

        while self.running:
            try:
                if HARDWARE_AVAILABLE:
                    # Citire reală
                    red, ir = self._read_fifo()
                    self.red_buffer.append(red)
                    self.ir_buffer.append(ir)

                    # Limitare dimensiune buffer
                    if len(self.ir_buffer) > self.buffer_size:
                        self.ir_buffer = self.ir_buffer[-self.buffer_size:]
                        self.red_buffer = self.red_buffer[-self.buffer_size:]

                    heart_rate, spo2 = self._calculate_hr_spo2()
                else:
                    heart_rate, spo2 = self._simulate_reading()

                if heart_rate is not None:
                    self.client.send_reading(
                        value_1=round(heart_rate, 1),
                        value_2=round(spo2, 1) if spo2 else None,
                        pacient_id=pacient_id,
                    )
                    print(f"[PULSOXIMETRU] HR: {heart_rate:.1f} BPM | SpO2: {spo2:.1f}%")

                time.sleep(INTERVALS["pulsoximetru"])

            except KeyboardInterrupt:
                break
            except Exception as e:
                print(f"[PULSOXIMETRU] Eroare: {e}")
                time.sleep(2)

        self.stop()

    def stop(self):
        """Oprește citirea."""
        self.running = False
        if HARDWARE_AVAILABLE:
            self.bus.close()
        self.client.disconnect_from_server()
        print("[PULSOXIMETRU] Oprit.")


def main():
    import argparse
    parser = argparse.ArgumentParser(description="Citire pulsoximetru MAX30102")
    parser.add_argument("--pacient", type=int, help="ID-ul pacientului monitorizat")
    args = parser.parse_args()

    sensor = PulsOximeter()

    def signal_handler(sig, frame):
        sensor.stop()
        sys.exit(0)

    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)

    sensor.start(pacient_id=args.pacient)


if __name__ == "__main__":
    main()
