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
import math
import os
import random

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
        self.median_window_size = max(1, int(ECG_INPUT.get("median_window_size", 5)))
        self.notch_enabled = bool(ECG_INPUT.get("notch_enabled", True))
        self.notch_freq_hz = float(ECG_INPUT.get("notch_freq_hz", 50.0))
        self.notch_r = float(ECG_INPUT.get("notch_r", 0.97))
        self.max_step_mv = float(ECG_INPUT.get("max_step_mv", 70.0))
        self.output_mode = str(ECG_INPUT.get("output_mode", os.getenv("ECG_OUTPUT_MODE", "raw"))).strip().lower()
        if self.output_mode not in ("raw", "filtered", "ac"):
            self.output_mode = "raw"
        self.reconnect_settle_samples = max(0, int(ECG_INPUT.get("reconnect_settle_samples", 20)))
        self._reconnect_skip_remaining = 0
        self._baseline_mv = None
        self._hp_prev_input = 0.0
        self._hp_prev_output = 0.0
        self._lp_prev_output = 0.0
        self._hum_prev_input = 0.0
        self._median_buffer_mv = []
        self._last_filtered_mv = None
        self._notch_x1 = 0.0
        self._notch_x2 = 0.0
        self._notch_y1 = 0.0
        self._notch_y2 = 0.0
        self._notch_b0 = 1.0
        self._notch_b1 = 0.0
        self._notch_b2 = 0.0
        self._notch_a1 = 0.0
        self._notch_a2 = 0.0
        self._last_sample_ts = None
        self._last_sr_update_at = 0.0
        self.adc_max_value = 1023.0
        self.hardware_available = HARDWARE_AVAILABLE
        if os.getenv("ECG_FORCE_SIM", "").strip().lower() in ("1", "true", "yes", "on"):
            self.hardware_available = False
            print("[ECG] ECG_FORCE_SIM activ - mod simulare forțat")
        self._update_notch_coeffs()

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
            return self._simulate_ecg_adc_value()

        if self.backend == "ads1115":
            return self._read_ads1115(channel)

        adc = self.spi.xfer2([1, (8 + channel) << 4, 0])
        value = ((adc[1] & 3) << 8) + adc[2]
        return value

    def _simulate_ecg_adc_value(self, t=None):
        """Semnal ECG simulat (P-QRS-T) ca să semene cu un ECG clasic.

        Scop: când librăriile/hardware-ul nu sunt disponibile, graficul din UI
        să arate coerent (complex QRS îngust + undă T/P), nu un semnal sinusoidal.
        """
        t = time.time() if t is None else float(t)
        hr_env = os.getenv("ECG_SIM_HR", "72").strip()
        try:
            heart_rate = float(hr_env)
        except ValueError:
            heart_rate = 72.0
        heart_rate = max(40.0, min(160.0, heart_rate))

        period = 60.0 / heart_rate
        phase = (t % period) / period

        def gauss(mu, sigma, amp):
            x = (phase - mu) / max(1e-6, sigma)
            return amp * math.exp(-0.5 * x * x)

        # Model P-QRS-T simplu, scalat apoi la valori ADC.
        p = gauss(0.18, 0.025, 0.12)
        q = gauss(0.37, 0.010, -0.15)
        r = gauss(0.40, 0.008, 1.00)
        s = gauss(0.43, 0.012, -0.25)
        tw = gauss(0.66, 0.045, 0.35)
        beat = p + q + r + s + tw

        # Drift lent optional pentru respiratie/miscare; implicit ramane oprit.
        wander_env = os.getenv("ECG_SIM_WANDER", "0").strip()
        try:
            wander_amp = float(wander_env)
        except ValueError:
            wander_amp = 0.0
        wander_amp = max(0.0, min(0.2, wander_amp))
        wander = wander_amp * math.sin(2.0 * math.pi * (t / 8.0))
        signal = beat + wander

        mid = self.adc_max_value / 2.0

        # Amplitudine moderata: UI-ul aplica oricum detrend si scalare.
        amp_env = os.getenv("ECG_SIM_AMP", "").strip()
        if amp_env:
            try:
                amp_counts = float(amp_env)
            except ValueError:
                amp_counts = self.adc_max_value * 0.06
        else:
            amp_counts = self.adc_max_value * 0.06

        value = mid + (signal * amp_counts)

        # Zgomot mic, doar cat sa nu fie un semnal perfect sintetic.
        noise_env = os.getenv("ECG_SIM_NOISE", "").strip()
        if noise_env:
            try:
                noise_counts = float(noise_env)
            except ValueError:
                noise_counts = self.adc_max_value * 0.0008
        else:
            noise_counts = self.adc_max_value * 0.0008

        value += random.gauss(0.0, max(0.0, noise_counts))

        return max(0, min(int(self.adc_max_value), int(round(value))))

    def _reset_filter_state(self):
        self._baseline_mv = None
        self._hp_prev_input = 0.0
        self._hp_prev_output = 0.0
        self._lp_prev_output = 0.0
        self._hum_prev_input = 0.0
        self._median_buffer_mv = []
        self._last_filtered_mv = None
        self._notch_x1 = 0.0
        self._notch_x2 = 0.0
        self._notch_y1 = 0.0
        self._notch_y2 = 0.0

    def _update_notch_coeffs(self):
        fs = max(20.0, float(self.sample_rate_hz))
        f0 = max(1.0, min(self.notch_freq_hz, (fs * 0.45)))
        r = max(0.85, min(0.999, self.notch_r))

        w0 = (2.0 * math.pi * f0) / fs
        c = math.cos(w0)

        self._notch_b0 = 1.0
        self._notch_b1 = -2.0 * c
        self._notch_b2 = 1.0
        self._notch_a1 = -2.0 * r * c
        self._notch_a2 = r * r

    def _filter_ecg_mv(self, raw_mv):
        baseline_mv, ac_mv = self._filter_ecg_components(raw_mv)
        filtered_mv = baseline_mv + ac_mv
        return max(0.0, min(3300.0, filtered_mv))

    def _filter_ecg_ac_mv(self, raw_mv):
        """Filtrare ECG: returnează doar componenta AC (mV), centrată în jurul lui 0."""
        _baseline_mv, ac_mv = self._filter_ecg_components(raw_mv)
        # Clamp larg de siguranta; UI-ul decide scalarea finala.
        return max(-2000.0, min(2000.0, ac_mv))

    def _filter_ecg_components(self, raw_mv):
        """Returnează (baseline_mv, ac_mv) pentru un eșantion.

        - baseline_mv: componenta DC (estimare lentă)
        - ac_mv: componenta filtrată (morfologie ECG), centrată pe 0
        """
        if not self.filter_enabled:
            if self._baseline_mv is None:
                self._baseline_mv = raw_mv
            return self._baseline_mv, raw_mv - self._baseline_mv

        # Eliminam impulsurile ADC inainte de filtrarea benzii ECG.
        self._median_buffer_mv.append(raw_mv)
        if len(self._median_buffer_mv) > self.median_window_size:
            self._median_buffer_mv = self._median_buffer_mv[-self.median_window_size:]
        sorted_buf = sorted(self._median_buffer_mv)
        raw_mv = sorted_buf[len(sorted_buf) // 2]

        if self._baseline_mv is None:
            self._baseline_mv = raw_mv

        # EMA lenta separa componenta AC de offset-ul DC.
        self._baseline_mv = self._baseline_mv + (self.baseline_alpha * (raw_mv - self._baseline_mv))
        centered = raw_mv - self._baseline_mv

        # Atenuare 50Hz pentru setup-uri apropiate de rata tinta.
        if self.hum_suppress_50hz:
            target = self.hum_sample_rate_target
            tol = max(0.01, self.hum_sample_rate_tolerance)
            if abs(self.sample_rate_hz - target) <= (target * tol):
                centered = 0.5 * (centered + self._hum_prev_input)
            self._hum_prev_input = raw_mv - self._baseline_mv

        highpassed = self.highpass_alpha * (self._hp_prev_output + centered - self._hp_prev_input)
        self._hp_prev_input = centered
        self._hp_prev_output = highpassed

        if self.notch_enabled:
            x0 = highpassed
            y0 = (
                (self._notch_b0 * x0)
                + (self._notch_b1 * self._notch_x1)
                + (self._notch_b2 * self._notch_x2)
                - (self._notch_a1 * self._notch_y1)
                - (self._notch_a2 * self._notch_y2)
            )

            self._notch_x2 = self._notch_x1
            self._notch_x1 = x0
            self._notch_y2 = self._notch_y1
            self._notch_y1 = y0
            highpassed = y0

        lowpassed = self._lp_prev_output + (self.lowpass_alpha * (highpassed - self._lp_prev_output))
        self._lp_prev_output = lowpassed

        # Limitare slew pentru spike-uri rare, fara a distruge morfologia ECG.
        if self._last_filtered_mv is not None and self.max_step_mv > 0:
            delta = lowpassed - self._last_filtered_mv
            if delta > self.max_step_mv:
                lowpassed = self._last_filtered_mv + self.max_step_mv
            elif delta < -self.max_step_mv:
                lowpassed = self._last_filtered_mv - self.max_step_mv

        self._last_filtered_mv = lowpassed
        return self._baseline_mv, lowpassed

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
                    if self.last_leads_state is False:
                        self._reset_filter_state()
                        self._reconnect_skip_remaining = self.reconnect_settle_samples
                        print(
                            f"[ECG] Electrozi reconectati (LO+={lo_plus}, LO-={lo_minus}) - "
                            f"stabilizare {self._reconnect_skip_remaining} esantioane"
                        )

                    value = self.read_adc(self.ecg_channel)
                    raw_mv = (value / self.adc_max_value) * 3300.0

                    # Rata efectiva ajuta notch-ul cand sistemul are jitter.
                    now = time.time()
                    if self._last_sample_ts is not None:
                        dt = now - self._last_sample_ts
                        if 0.001 <= dt <= 0.05:
                            inst_hz = 1.0 / max(1e-6, dt)
                            prev_hz = float(self.sample_rate_hz)
                            self.sample_rate_hz = (0.9 * prev_hz) + (0.1 * inst_hz)
                            if abs(self.sample_rate_hz - prev_hz) >= 2.0 and (now - self._last_sr_update_at) >= 0.35:
                                self._update_notch_coeffs()
                                self._last_sr_update_at = now
                    self._last_sample_ts = now

                    # value_2 transmite modul: 1=raw, 2=filtered, 3=AC centrat pe 0mV.
                    mode_code = 1
                    if self.output_mode == "ac":
                        voltage_mv = self._filter_ecg_ac_mv(raw_mv)
                        mode_code = 3
                    elif self.output_mode == "filtered":
                        voltage_mv = self._filter_ecg_mv(raw_mv)
                        mode_code = 2
                    else:
                        voltage_mv = raw_mv
                    self.last_raw_value = value
                    self.last_raw_mv = raw_mv
                    self.last_value_mv = voltage_mv
                    self.samples_since_log += 1
                    self.total_samples += 1

                    if self._reconnect_skip_remaining > 0:
                        self._reconnect_skip_remaining -= 1
                        self.last_leads_state = True
                        time.sleep(INTERVALS["ecg"])
                        continue

                    self.batch.append({
                        "value": voltage_mv,
                        "value_2": mode_code,
                        "timestamp": time.time(),
                        "leads_ok": True,
                    })

                    if len(self.batch) >= BATCH_SIZE["ecg"]:
                        self.client.send_batch(self.batch, pacient_id)
                        self.batch = []
                        self.total_batches_sent += 1

                    self.last_leads_state = True
                else:
                    now = time.time()
                    self._reset_filter_state()
                    if (now - self.last_leadoff_sent_at) >= self.leadoff_send_interval_seconds:
                        self.client.send_reading(
                            value_1=0,
                            value_2=None,
                            pacient_id=pacient_id,
                            leads_ok=False,
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
