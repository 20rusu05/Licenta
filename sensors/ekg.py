"""
Citire senzor ECG AD8232 via ADC (MCP3008 sau ADS1115).

Conexiuni hardware uzuale:
    AD8232 -> ADC -> Raspberry Pi 5

    AD8232:
        - GND -> GND
        - 3.3V -> 3.3V
        - OUTPUT -> intrare analogica ADC (ex: ADS1115 A2)
        - LO+ -> GPIO 17
        - LO- -> GPIO 27
"""

import time
import signal
import sys

try:
    import RPi.GPIO as GPIO
    GPIO_AVAILABLE = True
except ImportError:
    GPIO_AVAILABLE = False

try:
    import spidev
    SPI_AVAILABLE = True
except ImportError:
    SPI_AVAILABLE = False

try:
    import smbus2
    from smbus2 import i2c_msg
    I2C_AVAILABLE = True
except ImportError:
    I2C_AVAILABLE = False

HARDWARE_AVAILABLE = GPIO_AVAILABLE and (SPI_AVAILABLE or I2C_AVAILABLE)
if not HARDWARE_AVAILABLE:
    print("[ECG] Biblioteci hardware indisponibile - mod simulare activat")

from sensor_client import SensorClient
from config import INTERVALS, PINS, ADC, ADS1115, BATCH_SIZE, ECG_INPUT


class ECGSensor:
    """Citire senzor ECG AD8232 prin ADC MCP3008."""

    def __init__(self):
        self.client = SensorClient("ecg")
        self.running = False
        self.batch = []
        self.backend = str(ECG_INPUT.get("backend", "mcp3008")).lower()
        self.ecg_channel = int(ECG_INPUT.get("channel", 0))
        self.ignore_leads = bool(ECG_INPUT.get("ignore_leads", False))
        self.lead_off_active_high = bool(ECG_INPUT.get("lead_off_active_high", True))
        self.lead_window_size = max(1, int(ECG_INPUT.get("lead_window_size", 7)))
        self.lead_min_connected = max(1, int(ECG_INPUT.get("lead_min_connected", 5)))
        self.lo_gpio_pull = str(ECG_INPUT.get("lo_gpio_pull", "down")).lower()
        self.lead_disconnect_confirm_s = float(ECG_INPUT.get("lead_disconnect_confirm_s", 0.45))
        self.lead_reconnect_confirm_s = float(ECG_INPUT.get("lead_reconnect_confirm_s", 0.15))
        self.lead_history = []
        self.leads_filtered_ok = True
        self.leads_candidate_ok = None
        self.leads_candidate_since = 0.0
        self.last_leads_state = None
        self.last_leads_log_at = 0.0
        self.leads_log_interval_seconds = 2.0
        self.last_status_log_at = 0.0
        self.status_log_interval_seconds = 1.0
        self.samples_since_log = 0
        self.last_value_mv = 0.0
        self.last_raw_mv = 0.0
        self.last_raw_value = 0
        self.total_samples = 0
        self.total_batches_sent = 0
        self.last_leadoff_sent_at = 0.0
        self.leadoff_send_interval_seconds = 0.25
        self.sample_rate_hz = max(1.0, 1.0 / max(0.001, float(INTERVALS.get("ecg", 0.01))))
        self.filter_enabled = bool(ECG_INPUT.get("filter_enabled", True))
        self.hum_suppress_50hz = bool(ECG_INPUT.get("hum_suppress_50hz", True))
        self.hum_sample_rate_target = float(ECG_INPUT.get("hum_sample_rate_target", 100.0))
        self.hum_sample_rate_tolerance = float(ECG_INPUT.get("hum_sample_rate_tolerance", 0.25))
        self.highpass_alpha = float(ECG_INPUT.get("highpass_alpha", 0.985))
        self.lowpass_alpha = float(ECG_INPUT.get("lowpass_alpha", 0.35))
        self.baseline_alpha = float(ECG_INPUT.get("baseline_alpha", 0.01))
        self._baseline_mv = None
        self._hp_prev_input = 0.0
        self._hp_prev_output = 0.0
        self._lp_prev_output = 0.0
        self._hum_prev_input = 0.0
        self.adc_max_value = 1023.0
        self.hardware_available = HARDWARE_AVAILABLE

        if self.hardware_available:
            GPIO.setmode(GPIO.BCM)
            pull_mode = GPIO.PUD_OFF
            if self.lo_gpio_pull == "down":
                pull_mode = GPIO.PUD_DOWN
            elif self.lo_gpio_pull == "up":
                pull_mode = GPIO.PUD_UP

            GPIO.setup(PINS["ecg_lo_plus"], GPIO.IN, pull_up_down=pull_mode)
            GPIO.setup(PINS["ecg_lo_minus"], GPIO.IN, pull_up_down=pull_mode)

            if self.backend == "ads1115":
                if not I2C_AVAILABLE:
                    self.hardware_available = False
                    print("[ECG] smbus2 indisponibil - mod simulare activat")
                else:
                    self.i2c_bus = int(ADS1115.get("bus", 1))
                    self.address = int(ADS1115.get("address", 0x48))
                    self.pga = str(ADS1115.get("ecg_pga", "4.096"))
                    self.data_rate = int(ADS1115.get("ecg_data_rate", 860))
                    self.conversion_delay = max(0.0015, 1.25 / max(8, self.data_rate))
                    self.bus = smbus2.SMBus(self.i2c_bus)
                    self.address = self._probe_ads1115(self.address)
                    self.adc_max_value = 4095.0
                    print(
                        f"[ECG] ADS1115 activ: I2C-{self.i2c_bus} addr=0x{self.address:02X} "
                        f"canal=A{self.ecg_channel}, DR={self.data_rate}"
                    )
            else:
                if not SPI_AVAILABLE:
                    self.hardware_available = False
                    print("[ECG] spidev indisponibil - mod simulare activat")
                else:
                    self.spi = spidev.SpiDev()
                    self.spi.open(ADC["spi_port"], ADC["spi_device"])
                    self.spi.max_speed_hz = 1350000
                    print(
                        f"[ECG] MCP3008 activ: /dev/spidev{ADC['spi_port']}.{ADC['spi_device']} "
                        f"canal=CH{self.ecg_channel}"
                    )

    @staticmethod
    def _swap16(value):
        return ((value & 0xFF) << 8) | ((value >> 8) & 0xFF)

    def _probe_ads1115(self, preferred_addr):
        candidates = [preferred_addr, 0x49, 0x4A, 0x4B]
        checked = set()
        for addr in candidates:
            if addr in checked:
                continue
            checked.add(addr)
            try:
                write = i2c_msg.write(addr, [0x01])
                read = i2c_msg.read(addr, 2)
                self.bus.i2c_rdwr(write, read)
                return addr
            except Exception:
                continue
        raise RuntimeError("ADS1115 nu raspunde pe I2C (0x48-0x4B)")

    def _read_ads1115(self, channel):
        mux_map = {0: 0x4000, 1: 0x5000, 2: 0x6000, 3: 0x7000}
        mux = mux_map.get(channel, 0x6000)

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

        pga_bits = pga_map.get(self.pga, 0x0200)
        dr_bits = dr_map.get(self.data_rate, 0x00E0)
        config = (
            0x8000 |
            mux |
            pga_bits |
            0x0100 |
            dr_bits |
            0x0003
        )

        self.bus.write_word_data(self.address, 0x01, self._swap16(config))
        time.sleep(self.conversion_delay)

        raw = self._swap16(self.bus.read_word_data(self.address, 0x00))
        if raw & 0x8000:
            raw -= 1 << 16

        scaled = int((max(0, raw) / 32767.0) * 4095)
        return max(0, min(4095, scaled))

    def read_adc(self, channel):
        """Citire canal ADC (MCP3008 sau ADS1115)."""
        if not self.hardware_available:
            import math
            import random
            t = time.time()
            heart_rate = 72
            period = 60.0 / heart_rate
            phase = (t % period) / period

            if 0.0 <= phase < 0.05:
                value = 512 + 30 * math.sin(phase / 0.05 * math.pi)
            elif 0.15 <= phase < 0.18:
                value = 512 - 40 * math.sin((phase - 0.15) / 0.03 * math.pi)
            elif 0.18 <= phase < 0.22:
                value = 512 + 350 * math.sin((phase - 0.18) / 0.04 * math.pi)
            elif 0.22 <= phase < 0.26:
                value = 512 - 60 * math.sin((phase - 0.22) / 0.04 * math.pi)
            elif 0.30 <= phase < 0.45:
                value = 512 + 50 * math.sin((phase - 0.30) / 0.15 * math.pi)
            else:
                value = 512

            value += random.gauss(0, 5)
            return max(0, min(int(self.adc_max_value), int(value)))

        if self.backend == "ads1115":
            return self._read_ads1115(channel)

        adc = self.spi.xfer2([1, (8 + channel) << 4, 0])
        value = ((adc[1] & 3) << 8) + adc[2]
        return value

    def _reset_filter_state(self):
        self._baseline_mv = None
        self._hp_prev_input = 0.0
        self._hp_prev_output = 0.0
        self._lp_prev_output = 0.0
        self._hum_prev_input = 0.0

    def _filter_ecg_mv(self, raw_mv):
        if not self.filter_enabled:
            return max(0.0, min(3300.0, raw_mv))

        if self._baseline_mv is None:
            self._baseline_mv = raw_mv

        # Baseline estimation (very slow EMA) to separate AC component from DC offset.
        self._baseline_mv = self._baseline_mv + (self.baseline_alpha * (raw_mv - self._baseline_mv))
        centered = raw_mv - self._baseline_mv

        # 50Hz hum suppression for setups sampling near 100Hz: simple Nyquist notch.
        if self.hum_suppress_50hz:
            target = self.hum_sample_rate_target
            tol = max(0.01, self.hum_sample_rate_tolerance)
            if abs(self.sample_rate_hz - target) <= (target * tol):
                centered = 0.5 * (centered + self._hum_prev_input)
            self._hum_prev_input = raw_mv - self._baseline_mv

        highpassed = self.highpass_alpha * (self._hp_prev_output + centered - self._hp_prev_input)
        self._hp_prev_input = centered
        self._hp_prev_output = highpassed

        lowpassed = self._lp_prev_output + (self.lowpass_alpha * (highpassed - self._lp_prev_output))
        self._lp_prev_output = lowpassed

        filtered_mv = self._baseline_mv + lowpassed
        return max(0.0, min(3300.0, filtered_mv))

    def _instant_leads_ok(self, lo_plus, lo_minus):
        if self.ignore_leads:
            return True

        if self.lead_off_active_high:
            # Varianta tipica AD8232: HIGH = lead-off, LOW = contact.
            return lo_plus == 0 and lo_minus == 0

        # Unele clone/module au logica inversata.
        return lo_plus == 1 and lo_minus == 1

    def check_leads(self):
        """Verifica electrozii cu debounce si intoarce (connected, lo_plus, lo_minus)."""
        if not self.hardware_available:
            return True, 0, 0

        lo_plus = GPIO.input(PINS["ecg_lo_plus"])
        lo_minus = GPIO.input(PINS["ecg_lo_minus"])

        if self.ignore_leads:
            return True, lo_plus, lo_minus

        instant_ok = self._instant_leads_ok(lo_plus, lo_minus)

        self.lead_history.append(1 if instant_ok else 0)
        if len(self.lead_history) > self.lead_window_size:
            self.lead_history = self.lead_history[-self.lead_window_size:]

        connected_votes = sum(self.lead_history)
        voted_ok = connected_votes >= self.lead_min_connected

        now = time.time()
        if self.leads_candidate_ok is None or self.leads_candidate_ok != voted_ok:
            self.leads_candidate_ok = voted_ok
            self.leads_candidate_since = now

        required = self.lead_disconnect_confirm_s if not voted_ok else self.lead_reconnect_confirm_s
        if (now - self.leads_candidate_since) >= required:
            self.leads_filtered_ok = voted_ok

        return self.leads_filtered_ok, lo_plus, lo_minus

    def start(self, pacient_id=None):
        """Pornește citirea ECG."""
        self.running = True
        self.client.connect_to_server()

        print("[ECG] Citire pornită. CTRL+C pentru oprire.")
        if self.ignore_leads:
            print("[ECG] Mod test activ: ignore_leads=True (LO+/LO- sunt ignorate)")

        while self.running:
            try:
                leads_ok, lo_plus, lo_minus = self.check_leads()

                if leads_ok:
                    value = self.read_adc(self.ecg_channel)
                    raw_mv = (value / self.adc_max_value) * 3300.0
                    voltage_mv = self._filter_ecg_mv(raw_mv)
                    self.last_raw_value = value
                    self.last_raw_mv = raw_mv
                    self.last_value_mv = voltage_mv
                    self.samples_since_log += 1
                    self.total_samples += 1

                    self.batch.append({
                        "value": voltage_mv,
                        "timestamp": time.time(),
                        "leads_ok": True,
                    })

                    if len(self.batch) >= BATCH_SIZE["ecg"]:
                        self.client.send_batch(self.batch, pacient_id)
                        self.batch = []
                        self.total_batches_sent += 1

                    if self.last_leads_state is False:
                        print(f"[ECG] Electrozi reconectati (LO+={lo_plus}, LO-={lo_minus})")
                    self.last_leads_state = True
                else:
                    now = time.time()
                    self._reset_filter_state()
                    if (now - self.last_leadoff_sent_at) >= self.leadoff_send_interval_seconds:
                        self.client.send_reading(
                            value_1=0,
                            value_2=None,
                            pacient_id=pacient_id
                        )
                        self.last_leadoff_sent_at = now
                    if self.last_leads_state is not False or (now - self.last_leads_log_at) >= self.leads_log_interval_seconds:
                        print(
                            f"[ECG] ⚠ Electrozi deconectati! "
                            f"(LO+={lo_plus}, LO-={lo_minus}, "
                            f"logic={'HIGH=off' if self.lead_off_active_high else 'LOW=off'}, "
                            f"ignore={self.ignore_leads})"
                        )
                        self.last_leads_log_at = now
                    self.last_leads_state = False

                now = time.time()
                if (now - self.last_status_log_at) >= self.status_log_interval_seconds:
                    leads_text = "OK" if leads_ok else "OFF"
                    print(
                        f"[ECG] live: leads={leads_text} raw={self.last_raw_value} "
                        f"mv_raw={self.last_raw_mv:.1f} mv={self.last_value_mv:.1f} buffer={len(self.batch)} "
                        f"samples/s={self.samples_since_log} batches={self.total_batches_sent}"
                    )
                    self.samples_since_log = 0
                    self.last_status_log_at = now

                time.sleep(INTERVALS["ecg"])

            except KeyboardInterrupt:
                break
            except Exception as e:
                print(f"[ECG] Eroare: {e}")
                time.sleep(1)

        self.stop()

    def stop(self):
        """Oprește citirea ECG."""
        self.running = False
        if self.hardware_available:
            if self.backend == "ads1115":
                self.bus.close()
            else:
                self.spi.close()
            GPIO.cleanup()
        self.client.disconnect_from_server()
        print("[ECG] Oprit.")


def main():
    import argparse
    parser = argparse.ArgumentParser(description="Citire senzor ECG AD8232")
    parser.add_argument("--pacient", type=int, help="ID-ul pacientului monitorizat")
    args = parser.parse_args()

    sensor = ECGSensor()

    def signal_handler(sig, frame):
        sensor.stop()
        sys.exit(0)

    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)

    sensor.start(pacient_id=args.pacient)


if __name__ == "__main__":
    main()
