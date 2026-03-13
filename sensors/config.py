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

I2C = {
    "bus": 1,
    "max30102_addr": 0x57,
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
