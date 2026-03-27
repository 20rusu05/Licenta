"""
Diagnostic rapid pentru AD8232 + ADS1115 (fara trimitere la server).

Scop:
- confirma ca ADS1115 raspunde pe I2C
- confirma ca semnalul ECG este citit de pe canalul configurat (implicit A2)
- arata starea LO+/LO- pentru electrozi (fara a necesita backend)

Util:
- cand electrozii NU sunt pusi pe piele si vrei sa separi problemele HW/SW
"""

import argparse
import statistics
import time

try:
    import smbus2
    from smbus2 import i2c_msg
    import RPi.GPIO as GPIO
except ImportError as exc:
    raise SystemExit(f"[ECG-DIAG] Lipsesc biblioteci hardware: {exc}")

from config import ADS1115, PINS, ECG_INPUT

LOG = "[ECG-DIAG]"


def swap16(value):
    return ((value & 0xFF) << 8) | ((value >> 8) & 0xFF)


def probe_ads1115(bus, preferred_addr):
    candidates = [preferred_addr, 0x49, 0x4A, 0x4B]
    seen = set()
    for addr in candidates:
        if addr in seen:
            continue
        seen.add(addr)
        try:
            write = i2c_msg.write(addr, [0x01])
            read = i2c_msg.read(addr, 2)
            bus.i2c_rdwr(write, read)
            return addr
        except Exception:
            continue
    return None


def read_ads_single_ended(bus, addr, channel, pga, data_rate):
    mux_map = {0: 0x4000, 1: 0x5000, 2: 0x6000, 3: 0x7000}
    pga_map = {
        "6.144": 0x0000,
        "4.096": 0x0200,
        "2.048": 0x0400,
        "1.024": 0x0600,
        "0.512": 0x0800,
        "0.256": 0x0A00,
    }
    dr_map = {
        8: 0x0000,
        16: 0x0020,
        32: 0x0040,
        64: 0x0060,
        128: 0x0080,
        250: 0x00A0,
        475: 0x00C0,
        860: 0x00E0,
    }

    mux_bits = mux_map.get(channel, 0x6000)
    pga_bits = pga_map.get(pga, 0x0200)
    dr_bits = dr_map.get(data_rate, 0x00E0)

    config = 0x8000 | mux_bits | pga_bits | 0x0100 | dr_bits | 0x0003
    bus.write_word_data(addr, 0x01, swap16(config))

    conversion_delay = max(0.0015, 1.25 / max(8, data_rate))
    time.sleep(conversion_delay)

    raw = swap16(bus.read_word_data(addr, 0x00))
    if raw & 0x8000:
        raw -= 1 << 16

    # Pentru AD8232 in single-ended ne intereseaza componenta pozitiva.
    scaled = int((max(0, raw) / 32767.0) * 4095)
    return max(0, min(4095, scaled))


def summarize(values):
    if not values:
        return {
            "min": 0,
            "max": 0,
            "span": 0,
            "median": 0,
            "mean": 0,
            "std": 0,
        }

    mean_value = statistics.fmean(values)
    std_value = statistics.pstdev(values) if len(values) > 1 else 0.0
    return {
        "min": min(values),
        "max": max(values),
        "span": max(values) - min(values),
        "median": int(statistics.median(values)),
        "mean": mean_value,
        "std": std_value,
    }


def verdict(stats, lo_plus, lo_minus):
    lead_text = "LO+/LO- indica electrozi neconectati (normal daca nu sunt pe piele)."
    if lo_plus == 0 and lo_minus == 0:
        lead_text = "LO+/LO- indica electrozi conectati (contact detectat)."

    if stats["span"] == 0:
        signal_text = "Semnal complet plat: verifica OUTPUT -> A2, GND comun si alimentarea AD8232."
    elif stats["span"] < 4:
        signal_text = "Semnal aproape plat: traseu analogic foarte slab sau intrare blocata."
    elif stats["span"] < 20:
        signal_text = "Semnal prezent, dar mic: hardware probabil OK; amplitudinea creste cu electrozi montati corect."
    else:
        signal_text = "Semnal variabil: ADC + traseu analogic functionale."

    rail_high = stats["median"] >= 4085
    rail_low = stats["median"] <= 10
    if rail_high:
        rail_text = "Nivel aproape de rail HIGH: posibil OUTPUT tras sus / pin gresit."
    elif rail_low:
        rail_text = "Nivel aproape de rail LOW: posibil scurt la GND / pin gresit."
    else:
        rail_text = "Nivel median in interval util (nu este lipit la rail)."

    return lead_text, signal_text, rail_text


def main():
    parser = argparse.ArgumentParser(description="Diagnostic AD8232 + ADS1115")
    parser.add_argument("--seconds", type=float, default=8.0, help="Durata capturii")
    parser.add_argument("--rate", type=float, default=120.0, help="Frecventa esantionare")
    args = parser.parse_args()

    channel = int(ECG_INPUT.get("channel", 2))
    i2c_bus = int(ADS1115.get("bus", 1))
    preferred_addr = int(ADS1115.get("address", 0x48))
    pga = str(ADS1115.get("ecg_pga", "4.096"))
    data_rate = int(ADS1115.get("ecg_data_rate", 860))

    print(f"{LOG} Start diagnostic: ADS1115 A{channel}, durata={args.seconds}s, rate={args.rate}Hz")

    bus = smbus2.SMBus(i2c_bus)
    try:
        addr = probe_ads1115(bus, preferred_addr)
        if addr is None:
            raise SystemExit(f"{LOG} FAIL: ADS1115 nu raspunde pe I2C (0x48-0x4B)")
        print(f"{LOG} OK: ADS1115 detectat la 0x{addr:02X} pe I2C-{i2c_bus}")

        GPIO.setmode(GPIO.BCM)
        GPIO.setup(PINS["ecg_lo_plus"], GPIO.IN)
        GPIO.setup(PINS["ecg_lo_minus"], GPIO.IN)

        lo_plus = GPIO.input(PINS["ecg_lo_plus"])
        lo_minus = GPIO.input(PINS["ecg_lo_minus"])
        print(
            f"{LOG} LO+ GPIO{PINS['ecg_lo_plus']}={lo_plus} | "
            f"LO- GPIO{PINS['ecg_lo_minus']}={lo_minus}"
        )

        interval = 1.0 / max(1.0, args.rate)
        deadline = time.time() + max(1.0, args.seconds)
        values = []

        while time.time() < deadline:
            values.append(read_ads_single_ended(bus, addr, channel, pga, data_rate))
            time.sleep(interval)

        stats = summarize(values)
        lead_text, signal_text, rail_text = verdict(stats, lo_plus, lo_minus)

        print(
            f"{LOG} SAMPLES={len(values)} | min={stats['min']} max={stats['max']} "
            f"span={stats['span']} median={stats['median']} "
            f"mean={stats['mean']:.1f} std={stats['std']:.2f}"
        )
        print(f"{LOG} {lead_text}")
        print(f"{LOG} {signal_text}")
        print(f"{LOG} {rail_text}")

        if stats["span"] >= 4 and not (stats["median"] >= 4085 or stats["median"] <= 10):
            print(f"{LOG} VERDICT: traseul hardware pare functional (gata pentru test cu electrozi).")
        else:
            print(f"{LOG} VERDICT: exista indicii de problema pe cablaj/pozitionare. Verifica legaturile analogice.")

    finally:
        try:
            GPIO.cleanup()
        except Exception:
            pass
        bus.close()


if __name__ == "__main__":
    main()
