"""
Manager central pentru toți senzorii.
Pornește toate senzoarele simultan în thread-uri separate.
"""

import time
import signal
import sys
import threading
import argparse
import requests
import json

from ekg import ECGSensor
from puls import PulsOximeter
from temperatura import TemperatureSensor
from config import SERVER_URL, SENSOR_TLS_VERIFY, SENSOR_TLS_CA_CERT, DEVICE_ID


def get_assigned_patient_for_device():
    """Obține ID-ul pacientului asignat dispozitivului din backend."""
    try:
        verify_ssl = SENSOR_TLS_CA_CERT if SENSOR_TLS_CA_CERT else (not bool(SENSOR_TLS_VERIFY) == False)
        response = requests.get(
            f"{SERVER_URL}/api/sensors/device-patient/{DEVICE_ID}",
            verify=verify_ssl,
            timeout=5
        )
        if response.status_code == 200:
            data = response.json()
            pacient_id = data.get("pacient_id")
            if pacient_id:
                print(f"[MANAGER] Pacient detectat: {pacient_id} (asignat dispozitivului {DEVICE_ID})")
                return pacient_id
        elif response.status_code == 404:
            print(f"[MANAGER] No patient assigned to device {DEVICE_ID}")
        else:
            print(f"[MANAGER] Eroare server: {response.status_code}")
    except Exception as e:
        print(f"[MANAGER] Eroare conectare la server: {e}")
    return None


class SensorManager:
    """Manager care rulează toți senzorii simultan."""

    def __init__(self, pacient_id=None, sensors_to_run=None):
        self.pacient_id = pacient_id
        self.sensors = {}
        self.threads = {}
        self.running = False

        available_sensors = {
            "ecg": ECGSensor,
            "puls": PulsOximeter,
            "temperatura": TemperatureSensor,
        }

        if sensors_to_run is None:
            sensors_to_run = list(available_sensors.keys())

        for name in sensors_to_run:
            if name in available_sensors:
                if name in self.sensors:
                    continue
                try:
                    self.sensors[name] = available_sensors[name]()
                    print(f"[MANAGER] Senzor '{name}' inițializat")
                except Exception as e:
                    print(f"[MANAGER] Eroare inițializare '{name}': {e}")

    def start_all(self):
        """Pornește toți senzorii în thread-uri separate."""
        self.running = True
        print(f"\n{'='*50}")
        print(f"  Pornire {len(self.sensors)} senzori")
        print(f"  Pacient ID: {self.pacient_id or 'nespecificat'}")
        print(f"{'='*50}\n")

        for name, sensor in self.sensors.items():
            thread = threading.Thread(
                target=sensor.start,
                args=(self.pacient_id,),
                daemon=True,
                name=f"sensor-{name}"
            )
            self.threads[name] = thread
            thread.start()
            print(f"[MANAGER] Thread '{name}' pornit")

        try:
            while self.running:
                alive = sum(1 for t in self.threads.values() if t.is_alive())
                if alive == 0:
                    print("[MANAGER] Toți senzorii s-au oprit")
                    break
                time.sleep(1)
        except KeyboardInterrupt:
            print("\n[MANAGER] Oprire...")
            self.stop_all()

    def stop_all(self):
        """Oprește toți senzorii."""
        self.running = False
        for name, sensor in self.sensors.items():
            try:
                sensor.running = False
                print(f"[MANAGER] Oprire '{name}'...")
            except Exception as e:
                print(f"[MANAGER] Eroare oprire '{name}': {e}")

        for name, thread in self.threads.items():
            thread.join(timeout=5)

        print("[MANAGER] Toți senzorii opriți.")


def main():
    parser = argparse.ArgumentParser(
        description="Manager senzori Raspberry Pi 5 - NewMed",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Exemple de utilizare:
  python main.py                          # Pornește toți senzorii (pacient nespecificat)
  python main.py --pacient 1              # Monitorizare pacient cu ID 1
  python main.py --auto                   # Auto-detectează pacientul din backend
  python main.py --sensors ecg temperatura  # Doar ECG și temperatură
  python main.py --auto --sensors ecg     # Auto-detectează + doar ECG
        """
    )
    parser.add_argument("--pacient", type=int, help="ID-ul pacientului monitorizat")
    parser.add_argument("--auto", action="store_true", help="Auto-detectează pacientul din backend")
    parser.add_argument(
        "--sensors",
        nargs="+",
        choices=["ecg", "puls", "temperatura"],
        help="Senzorii de pornit (implicit: toți)"
    )
    args = parser.parse_args()

    pacient_id = args.pacient
    
    # Auto-detect patient if --auto flag is set
    if args.auto and not pacient_id:
        pacient_id = get_assigned_patient_for_device()
        if not pacient_id:
            print("[MANAGER] Nu s-a putut detecta pacientul. Continuez fără pacient_id.")

    manager = SensorManager(
        pacient_id=pacient_id,
        sensors_to_run=args.sensors
    )

    def signal_handler(sig, frame):
        manager.stop_all()
        sys.exit(0)

    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)

    manager.start_all()


if __name__ == "__main__":
    main()
