"""
Configurare centrală pentru senzorii Raspberry Pi 5
"""

SERVER_URL = "http://localhost:3001"

DEVICE_ID = "rpi5-01"

INTERVALS = {
    "ecg": 0.01,
    "pulsoximetru": 1.0,
    "temperatura": 2.0,
}

PINS = {
    "ecg_lo_plus": 17,
    "ecg_lo_minus": 27,
    "ds18b20_data": 4,
}

# Notă: Pe Raspberry Pi 5, SPI bus-ul este 10 (nu 0 ca pe RPi 3/4)
ADC = {
    "spi_port": 10,
    "spi_device": 0,
    "ecg_channel": 0,
}

ADS1115 = {
    "bus": 1,
    "address": 0x48,
    "pulse_channel": 0,
    "pga": "4.096",        # Evită saturarea când alimentăm senzorul la 3.3V
    "data_rate": 250,       # Conversii/secundă mai stabile pentru semnalul de puls
    "pulse_sample_rate_hz": 75,
}

DS18B20 = {
    "base_dir": "/sys/bus/w1/devices/",
    "device_folder_prefix": "28-",
}

BATCH_SIZE = {
    "ecg": 50,
    "pulsoximetru": 1,
    "temperatura": 1,
}
