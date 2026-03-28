"""
Configurare centrală pentru senzorii Raspberry Pi 5

Schema legaturi ECG (AD8232 + MCP3008 + Raspberry Pi 5):

AD8232 -> Raspberry Pi / MCP3008
    - SDN     -> 3.3V (tinut activ)
    - 3.3V    -> 3.3V pe Raspberry Pi
    - GND     -> GND pe Raspberry Pi
    - OUTPUT  -> CH0 pe MCP3008
    - LO+     -> GPIO17 (BCM)
    - LO-     -> GPIO27 (BCM)
    - RA/LA/RL -> doar la electrozi pe corp (nu la GPIO)

MCP3008 -> Raspberry Pi
    - VDD   -> 3.3V
    - VREF  -> 3.3V
    - AGND  -> GND
    - DGND  -> GND
    - CLK   -> GPIO11 (SPI SCLK)
    - DOUT  -> GPIO9  (SPI MISO)
    - DIN   -> GPIO10 (SPI MOSI)
    - CS    -> GPIO8  (SPI CE0)
    - CH0   -> OUTPUT de la AD8232
"""

SERVER_URL = "http://localhost:3001"

DEVICE_ID = "rpi5-01"

INTERVALS = {
    "ecg": 0.01,
    "puls": 1.0,
    "temperatura": 2.0,
}

ECG_INPUT = {
    "backend": "ads1115",  # "ads1115" sau "mcp3008"
    "channel": 2,            # A2 pentru ADS1115 (sau CH2 pentru MCP3008)
    "ignore_leads": False,    # True doar pentru test hardware (ignora LO+/LO-)
    "lead_off_active_high": True,  # AD8232 tipic: HIGH = lead-off
    "lo_gpio_pull": "down",  # "down" | "up" | "off" pentru stabilizare intrare GPIO
    "lead_window_size": 7,   # Debounce pentru LO+/LO-
    "lead_min_connected": 5, # Cate citiri din fereastra trebuie sa indice contact
    "lead_disconnect_confirm_s": 0.45,  # Cat timp trebuie sa ramana OFF ca sa il marcam deconectat
    "lead_reconnect_confirm_s": 0.15,   # Cat timp trebuie sa ramana ON ca sa il marcam reconectat
    "filter_enabled": True,
    "hum_suppress_50hz": True,
    "hum_sample_rate_target": 100.0,
    "hum_sample_rate_tolerance": 0.25,
    "highpass_alpha": 0.985,
    "lowpass_alpha": 0.35,
    "baseline_alpha": 0.01,
}

PINS = {
    "ecg_lo_plus": 17,
    "ecg_lo_minus": 27,
    "ds18b20_data": 22,
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
    "ecg_pga": "4.096",
    "ecg_data_rate": 860,
    "pga": "4.096",        # Profil echilibrat; codul ajusteaza automat daca apare saturatie
    "data_rate": 128,       # Mai lent, dar de obicei mai stabil pentru senzorul analogic de puls
    "pulse_sample_rate_hz": 50,
}

DS18B20 = {
    "base_dir": "/sys/bus/w1/devices/",
    "device_folder_prefix": "28-",
}

BATCH_SIZE = {
    "ecg": 50,
    "puls": 1,
    "temperatura": 1,
}
