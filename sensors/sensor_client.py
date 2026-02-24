"""
Modul de bază pentru comunicarea cu serverul backend.
Trimite datele senzorilor via HTTP POST + Socket.IO.
"""

import json
import time
import threading
import queue
import requests
import socketio

from config import SERVER_URL, DEVICE_ID


class SensorClient:
    """Client pentru trimiterea datelor senzorilor la server."""

    def __init__(self, sensor_type):
        self.sensor_type = sensor_type
        self.device_id = DEVICE_ID
        self.server_url = SERVER_URL
        self.sio = socketio.Client(reconnection=True, reconnection_delay=2)
        self.connected = False
        self.data_queue = queue.Queue(maxsize=1000)
        self._setup_socket_events()
        self._start_sender_thread()

    def _setup_socket_events(self):
        @self.sio.event
        def connect():
            self.connected = True
            print(f"[{self.sensor_type}] Conectat la server via WebSocket")
            # Înregistrează senzorul
            self.sio.emit("register_sensor", {
                "sensor_type": self.sensor_type,
                "device_id": self.device_id,
            })

        @self.sio.event
        def disconnect():
            self.connected = False
            print(f"[{self.sensor_type}] Deconectat de la server")

        @self.sio.on("command")
        def on_command(data):
            print(f"[{self.sensor_type}] Comandă primită: {data}")
            # Poate fi extins pentru control remote

    def connect_to_server(self):
        """Conectare la server via Socket.IO."""
        while True:
            try:
                print(f"[{self.sensor_type}] Se conectează la {self.server_url}...")
                self.sio.connect(self.server_url, transports=["websocket"])
                break
            except Exception as e:
                print(f"[{self.sensor_type}] Eroare conectare: {e}. Reîncerc în 5s...")
                time.sleep(5)

    def send_reading(self, value_1, value_2=None, pacient_id=None):
        """Trimite o citire la server."""
        data = {
            "sensor_type": self.sensor_type,
            "device_id": self.device_id,
            "value_1": value_1,
            "value_2": value_2,
            "pacient_id": pacient_id,
            "timestamp": time.time(),
        }
        try:
            self.data_queue.put_nowait(data)
        except queue.Full:
            # Dacă coada e plină, elimină cel mai vechi element
            try:
                self.data_queue.get_nowait()
            except queue.Empty:
                pass
            self.data_queue.put_nowait(data)

    def send_batch(self, readings, pacient_id=None):
        """Trimite un batch de citiri la server."""
        data = {
            "sensor_type": self.sensor_type,
            "device_id": self.device_id,
            "readings": readings,
            "pacient_id": pacient_id,
            "timestamp": time.time(),
        }
        if self.connected:
            try:
                self.sio.emit("sensor_batch", data)
            except Exception as e:
                print(f"[{self.sensor_type}] Eroare trimitere batch: {e}")

    def _start_sender_thread(self):
        """Thread separat pentru trimiterea datelor."""
        def sender():
            while True:
                try:
                    data = self.data_queue.get(timeout=1)
                    if self.connected:
                        self.sio.emit("sensor_data", data)
                    else:
                        # Fallback: trimite via HTTP
                        try:
                            requests.post(
                                f"{self.server_url}/api/sensors/reading",
                                json=data,
                                timeout=5
                            )
                        except Exception:
                            pass
                except queue.Empty:
                    continue
                except Exception as e:
                    print(f"[{self.sensor_type}] Eroare sender: {e}")
                    time.sleep(1)

        thread = threading.Thread(target=sender, daemon=True)
        thread.start()

    def disconnect_from_server(self):
        """Deconectare."""
        if self.connected:
            self.sio.disconnect()
