"""
Modul de bază pentru comunicarea cu serverul backend.
Trimite datele senzorilor via HTTP POST + Socket.IO.
"""

import json
import time
import threading
import queue
import requests
import os
import urllib3
from urllib.parse import urlparse

# Suprimă warninguri pentru self-signed certs în dev
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

try:
    import socketio
    SOCKETIO_AVAILABLE = True
except ImportError:
    socketio = None
    SOCKETIO_AVAILABLE = False

from config import SERVER_URL, DEVICE_ID, SENSOR_TLS_VERIFY, SENSOR_TLS_CA_CERT


class SensorClient:
    """Client pentru trimiterea datelor senzorilor la server."""

    def __init__(self, sensor_type):
        self.sensor_type = sensor_type
        self.device_id = DEVICE_ID
        self.server_url = SERVER_URL
        self.is_https = urlparse(self.server_url).scheme == "https"
        self.verify_tls = self._resolve_tls_verify()
        self.http_session = requests.Session()
        self.http_session.verify = self.verify_tls
        self.sio = None
        if SOCKETIO_AVAILABLE:
            self.sio = socketio.Client(
                reconnection=True,
                reconnection_delay=2,
                http_session=self.http_session,
                ssl_verify=self.verify_tls,
            )
        self.connected = False
        self.socketio_available = SOCKETIO_AVAILABLE
        self.data_queue = queue.Queue(maxsize=1000)
        if self.sio is not None:
            self._setup_socket_events()
        else:
            print(f"[{self.sensor_type}] python-socketio nu este instalat - mod HTTP only")
        self._start_sender_thread()

    def _resolve_tls_verify(self):
        # Prefer explicit certificate path when provided.
        if SENSOR_TLS_CA_CERT:
            if os.path.exists(SENSOR_TLS_CA_CERT):
                return SENSOR_TLS_CA_CERT
            print(f"[{self.sensor_type}] Atenție: SENSOR_TLS_CA_CERT inexistent: {SENSOR_TLS_CA_CERT}")

        # In local development we often use self-signed certs.
        if self.is_https and not SENSOR_TLS_VERIFY:
            print(f"[{self.sensor_type}] HTTPS activ cu verificare TLS dezactivată (mod dev)")
            return False

        return True

    def _setup_socket_events(self):
        if self.sio is None:
            return

        @self.sio.event
        def connect():
            self.connected = True
            print(f"[{self.sensor_type}] Conectat la server via WebSocket")
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

    def connect_to_server(self):
        """Conectare la server via Socket.IO."""
        if self.sio is None:
            print(f"[{self.sensor_type}] WebSocket indisponibil - se folosește doar HTTP POST")
            return

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
        if self.connected and self.sio is not None:
            try:
                self.sio.emit("sensor_batch", data)
            except Exception as e:
                print(f"[{self.sensor_type}] Eroare trimitere batch: {e}")
        else:
            for reading in readings:
                self.send_reading(
                    value_1=reading.get("value"),
                    value_2=None,
                    pacient_id=pacient_id,
                )

    def _start_sender_thread(self):
        """Thread separat pentru trimiterea datelor."""
        def sender():
            while True:
                try:
                    data = self.data_queue.get(timeout=1)
                    if self.connected:
                        self.sio.emit("sensor_data", data)
                    else:
                        try:
                            requests.post(
                                f"{self.server_url}/api/sensors/reading",
                                json=data,
                                verify=self.verify_tls,
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
        if self.connected and self.sio is not None:
            self.sio.disconnect()
