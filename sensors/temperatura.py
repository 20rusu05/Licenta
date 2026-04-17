"""
Citire senzor temperatură DS18B20 (1-Wire).

Conexiuni hardware:
  DS18B20 → Raspberry Pi 5
  - VCC (roșu) → 3.3V
  - GND (negru) → GND
    - DATA (galben) → GPIO configurat (acum GPIO 22)
  - Rezistor pull-up 4.7kΩ între DATA și VCC

Notă: Trebuie activat 1-Wire în raspi-config sau /boot/firmware/config.txt:
    dtoverlay=w1-gpio,gpiopin=22
"""

import time
import signal
import sys
import os
import glob

from sensor_client import SensorClient
from config import INTERVALS, DS18B20, PINS

HARDWARE_AVAILABLE = os.path.isdir(DS18B20["base_dir"])
DS18B20_READ_TIMEOUT_S = 2.0
DS18B20_READ_POLL_S = 0.2
DS18B20_MAX_RETRIES = 3


class TemperatureSensor:
    """Citire senzor temperatură DS18B20."""

    def __init__(self):
        self.client = SensorClient("temperatura")
        self.running = False
        self.device_file = None
        self.last_valid_temperature = None

        if HARDWARE_AVAILABLE:
            self._find_device()
        else:
            print("[TEMPERATURĂ] Senzor DS18B20 nedetectat - mod simulare activat")

    def _find_device(self):
        """Găsește dispozitivul DS18B20 conectat."""
        device_folders = glob.glob(
            os.path.join(DS18B20["base_dir"], DS18B20["device_folder_prefix"] + "*")
        )

        if device_folders:
            self.device_file = os.path.join(device_folders[0], "w1_slave")
            device_id = os.path.basename(device_folders[0])
            print(f"[TEMPERATURĂ] Senzor găsit: {device_id}")
            return True
        else:
            self.device_file = None
            print("[TEMPERATURĂ] ⚠ Niciun senzor DS18B20 detectat!")
            print("  Verifică:")
            print(f"  1. dtoverlay=w1-gpio,gpiopin={PINS['ds18b20_data']} în /boot/firmware/config.txt")
            print(f"  2. Conexiunea fizică (DATA → GPIO {PINS['ds18b20_data']}, rezistor 4.7kΩ)")
            print("  3. sudo modprobe w1-gpio && sudo modprobe w1-therm")
            return False

    def _ensure_device(self):
        """Reîncearcă detectarea dispozitivului dacă a dispărut."""
        if self.device_file and os.path.exists(self.device_file):
            return True
        return self._find_device()

    def _read_raw(self):
        """Citire brută din fișierul senzorului."""
        with open(self.device_file, "r") as f:
            lines = f.readlines()
        return lines

    def read_temperature(self):
        """Citire temperatură în grade Celsius."""
        if not HARDWARE_AVAILABLE or not self.device_file:
            return self._simulate_temperature()

        for attempt in range(1, DS18B20_MAX_RETRIES + 1):
            if not self._ensure_device():
                time.sleep(DS18B20_READ_POLL_S)
                continue

            try:
                lines = self._read_raw()
                deadline = time.time() + DS18B20_READ_TIMEOUT_S

                while lines and lines[0].strip()[-3:] != "YES":
                    if time.time() >= deadline:
                        print("[TEMPERATURĂ] Timeout la validarea citirii DS18B20")
                        break
                    time.sleep(DS18B20_READ_POLL_S)
                    lines = self._read_raw()

                if len(lines) < 2:
                    print("[TEMPERATURĂ] Răspuns DS18B20 incomplet")
                    continue

                equals_pos = lines[1].find("t=")
                if equals_pos != -1:
                    temp_string = lines[1][equals_pos + 2:]
                    temp_celsius = float(temp_string) / 1000.0
                    temp_celsius = round(temp_celsius, 2)
                    self.last_valid_temperature = temp_celsius
                    return temp_celsius

            except FileNotFoundError:
                self.device_file = None
                print("[TEMPERATURĂ] Dispozitivul DS18B20 a dispărut temporar; reîncerc detectarea")
            except Exception as e:
                print(f"[TEMPERATURĂ] Eroare citire (încercarea {attempt}/{DS18B20_MAX_RETRIES}): {e}")

            time.sleep(DS18B20_READ_POLL_S)

        if self.last_valid_temperature is not None:
            print("[TEMPERATURĂ] Folosesc ultima temperatură validă până revine senzorul")
            return self.last_valid_temperature

        print("[TEMPERATURĂ] Folosesc temperatură simulată temporar până revine senzorul")
        return self._simulate_temperature()

    def _simulate_temperature(self):
        """Generează temperatură simulată."""
        import random
        import math

        t = time.time()
        base_temp = 36.6
        temp = base_temp + 0.3 * math.sin(t * 0.05) + random.gauss(0, 0.1)
        return round(temp, 2)

    def start(self, pacient_id=None):
        """Pornește citirea temperaturii."""
        self.running = True
        self.client.connect_to_server()

        print("[TEMPERATURĂ] Citire pornită. CTRL+C pentru oprire.")

        while self.running:
            try:
                temp = self.read_temperature()

                if temp is not None:
                    self.client.send_reading(
                        value_1=temp,
                        pacient_id=pacient_id,
                    )
                    print(f"[TEMPERATURĂ] {temp}°C")

                time.sleep(INTERVALS["temperatura"])

            except KeyboardInterrupt:
                break
            except Exception as e:
                print(f"[TEMPERATURĂ] Eroare: {e}")
                time.sleep(2)

        self.stop()

    def stop(self):
        """Oprește citirea."""
        self.running = False
        self.client.disconnect_from_server()
        print("[TEMPERATURĂ] Oprit.")


def main():
    import argparse
    parser = argparse.ArgumentParser(description="Citire senzor temperatură DS18B20")
    parser.add_argument("--pacient", type=int, help="ID-ul pacientului monitorizat")
    args = parser.parse_args()

    sensor = TemperatureSensor()

    def signal_handler(sig, frame):
        sensor.stop()
        sys.exit(0)

    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)

    sensor.start(pacient_id=args.pacient)


if __name__ == "__main__":
    main()
