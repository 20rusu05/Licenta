"""
Configurare centrală pentru senzorii Raspberry Pi 5
"""

# Adresa serverului backend
SERVER_URL = "http://localhost:3001"

# ID-ul dispozitivului Raspberry Pi
DEVICE_ID = "rpi5-01"

# Intervale de citire (secunde)
INTERVALS = {
    "ecg": 0.01,           # 100 Hz pentru ECG (AD8232)
    "pulsoximetru": 1.0,   # 1 citire/secundă pentru MAX30102
    "temperatura": 2.0,    # 1 citire la 2 secunde pentru DS18B20
}

# Configurare pini GPIO (BCM numbering)
PINS = {
    "ecg_lo_plus": 17,     # AD8232 LO+ pin
    "ecg_lo_minus": 27,    # AD8232 LO- pin
    "ds18b20_data": 4,     # DS18B20 data pin (default 1-Wire)
}

# Configurare ADC (MCP3008) pentru ECG
# Notă: Pe Raspberry Pi 5, SPI bus-ul este 10 (nu 0 ca pe RPi 3/4)
ADC = {
    "spi_port": 10,
    "spi_device": 0,
    "ecg_channel": 0,      # Canal ADC pentru AD8232
}

# Configurare I2C pentru MAX30102
I2C = {
    "bus": 1,              # I2C bus pe RPi 5
    "max30102_addr": 0x57, # Adresa I2C default MAX30102
}

# Configurare DS18B20 (1-Wire)
DS18B20 = {
    "base_dir": "/sys/bus/w1/devices/",
    "device_folder_prefix": "28-",  # DS18B20 devices start with 28-
}

# Batch size - câte citiri se trimit odată la server  
BATCH_SIZE = {
    "ecg": 50,             # Trimite 50 citiri ECG odată
    "pulsoximetru": 1,     # Trimite imediat
    "temperatura": 1,      # Trimite imediat
}
