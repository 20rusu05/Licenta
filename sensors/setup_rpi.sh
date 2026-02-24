#!/bin/bash
# ============================================================
#  Script setup Raspberry Pi 5 pentru proiectul NewMed
#  Configurează: SPI, I2C, 1-Wire, Python + dependențe
# ============================================================

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}"
echo "╔══════════════════════════════════════════════════╗"
echo "║     NewMed - Setup Raspberry Pi 5 Senzori       ║"
echo "╚══════════════════════════════════════════════════╝"
echo -e "${NC}"

# 1. Update sistem
echo -e "${YELLOW}[1/7] Actualizare sistem...${NC}"
sudo apt-get update -y
sudo apt-get upgrade -y

# 2. Instalare pachete necesare
echo -e "${YELLOW}[2/7] Instalare pachete sistem...${NC}"
sudo apt-get install -y \
  python3 \
  python3-pip \
  python3-venv \
  python3-dev \
  python3-smbus \
  i2c-tools \
  git \
  build-essential

# 3. Activare interfețe hardware
echo -e "${YELLOW}[3/7] Activare interfețe hardware (SPI, I2C, 1-Wire)...${NC}"

CONFIG_FILE="/boot/firmware/config.txt"
if [ ! -f "$CONFIG_FILE" ]; then
  CONFIG_FILE="/boot/config.txt"
fi

# Funcție pentru adăugare linie dacă nu există
add_config() {
  if ! grep -q "^$1" "$CONFIG_FILE" 2>/dev/null; then
    echo "$1" | sudo tee -a "$CONFIG_FILE" > /dev/null
    echo -e "  ${GREEN}✓ Adăugat: $1${NC}"
  else
    echo -e "  ℹ Deja activ: $1"
  fi
}

# SPI (pentru MCP3008 ADC - senzor ECG)
add_config "dtparam=spi=on"

# I2C (pentru MAX30102 pulsoximetru)
add_config "dtparam=i2c_arm=on"

# 1-Wire (pentru DS18B20 temperatură)
add_config "dtoverlay=w1-gpio"

# 4. Încărcare module kernel
echo -e "${YELLOW}[4/7] Încărcare module kernel...${NC}"
sudo modprobe spi-bcm2835 2>/dev/null || true
sudo modprobe i2c-dev 2>/dev/null || true
sudo modprobe w1-gpio 2>/dev/null || true
sudo modprobe w1-therm 2>/dev/null || true

# Adaugă module la boot
if ! grep -q "i2c-dev" /etc/modules 2>/dev/null; then
  echo "i2c-dev" | sudo tee -a /etc/modules > /dev/null
fi
if ! grep -q "w1-gpio" /etc/modules 2>/dev/null; then
  echo "w1-gpio" | sudo tee -a /etc/modules > /dev/null
fi
if ! grep -q "w1-therm" /etc/modules 2>/dev/null; then
  echo "w1-therm" | sudo tee -a /etc/modules > /dev/null
fi

# 5. Adaugă utilizatorul la grupurile necesare
echo -e "${YELLOW}[5/7] Configurare permisiuni utilizator...${NC}"
sudo usermod -aG gpio,i2c,spi,dialout $USER 2>/dev/null || true
echo -e "  ${GREEN}✓ Utilizator adăugat la grupurile: gpio, i2c, spi, dialout${NC}"

# 6. Setup Python virtual environment + dependențe
echo -e "${YELLOW}[6/7] Configurare Python și dependențe...${NC}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SENSORS_DIR="$SCRIPT_DIR"

cd "$SENSORS_DIR"

# Creează virtual environment
if [ ! -d "venv" ]; then
  python3 -m venv venv
  echo -e "  ${GREEN}✓ Virtual environment creat${NC}"
fi

# Activează venv și instalează dependențe
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
echo -e "  ${GREEN}✓ Dependențe Python instalate${NC}"

# 7. Verificare hardware
echo -e "${YELLOW}[7/7] Verificare hardware...${NC}"

# Verificare I2C
echo -n "  I2C: "
if i2cdetect -y 1 > /dev/null 2>&1; then
  echo -e "${GREEN}✓ Funcțional${NC}"
  echo "  Dispozitive I2C detectate:"
  sudo i2cdetect -y 1 2>/dev/null | grep -v "^$" | head -5
else
  echo -e "${RED}✗ Nu funcționează (necesită reboot)${NC}"
fi

# Verificare SPI
echo -n "  SPI: "
if ls /dev/spidev* > /dev/null 2>&1; then
  echo -e "${GREEN}✓ Funcțional (/dev/spidev0.0)${NC}"
else
  echo -e "${RED}✗ Nu funcționează (necesită reboot)${NC}"
fi

# Verificare 1-Wire
echo -n "  1-Wire: "
if ls /sys/bus/w1/devices/ > /dev/null 2>&1; then
  echo -e "${GREEN}✓ Funcțional${NC}"
  TEMP_SENSORS=$(ls /sys/bus/w1/devices/ | grep "^28-" 2>/dev/null)
  if [ ! -z "$TEMP_SENSORS" ]; then
    echo -e "  Senzori temperatură detectați: $TEMP_SENSORS"
  else
    echo -e "  ${YELLOW}ℹ Niciun senzor DS18B20 detectat (conectează senzorul)${NC}"
  fi
else
  echo -e "${RED}✗ Nu funcționează (necesită reboot)${NC}"
fi

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════╗"
echo "║              Setup complet!                      ║"
echo "╚══════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  ${YELLOW}⚠ Dacă interfețele hardware nu funcționează,${NC}"
echo -e "  ${YELLOW}  RESTARTEAZĂ Raspberry Pi: sudo reboot${NC}"
echo ""
echo "  Comenzi utile:"
echo "    cd $(pwd)"
echo "    source venv/bin/activate"
echo "    python main.py                        # Toți senzorii"
echo "    python main.py --pacient 1            # Cu ID pacient"
echo "    python ekg.py                         # Doar ECG"
echo "    python pulsoximetru.py                # Doar puls"
echo "    python temperatura.py                 # Doar temperatură"
echo ""
echo -e "  ${GREEN}Schema conexiuni hardware:${NC}"
echo ""
echo "  ┌─────────────────────────────────────────────────┐"
echo "  │              RASPBERRY PI 5                     │"
echo "  │                                                 │"
echo "  │  3.3V (Pin 1) ──┬── AD8232 VCC                 │"
echo "  │                 ├── MCP3008 VDD/VREF            │"
echo "  │                 ├── MAX30102 VIN                │"
echo "  │                 └── DS18B20 VCC + R(4.7kΩ)     │"
echo "  │                                                 │"
echo "  │  GND  (Pin 6) ──┬── AD8232 GND                 │"
echo "  │                 ├── MCP3008 AGND/DGND           │"
echo "  │                 ├── MAX30102 GND                │"
echo "  │                 └── DS18B20 GND                 │"
echo "  │                                                 │"
echo "  │  GPIO 4  (Pin 7)  → DS18B20 DATA               │"
echo "  │  GPIO 2  (Pin 3)  → MAX30102 SDA (I2C)         │"
echo "  │  GPIO 3  (Pin 5)  → MAX30102 SCL (I2C)         │"
echo "  │  GPIO 8  (Pin 24) → MCP3008 CS (SPI CE0)       │"
echo "  │  GPIO 10 (Pin 19) → MCP3008 DIN (SPI MOSI)     │"
echo "  │  GPIO 9  (Pin 21) → MCP3008 DOUT (SPI MISO)    │"
echo "  │  GPIO 11 (Pin 23) → MCP3008 CLK (SPI SCLK)     │"
echo "  │  GPIO 17 (Pin 11) → AD8232 LO+                 │"
echo "  │  GPIO 27 (Pin 13) → AD8232 LO-                 │"
echo "  │                                                 │"
echo "  │  MCP3008 CH0 ← AD8232 OUTPUT                   │"
echo "  └─────────────────────────────────────────────────┘"
