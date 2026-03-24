"""
Citire senzor de puls analogic (3 pini: S, +, -) via ADS1115.

Conexiuni hardware:
    Senzor puls -> ADS1115 -> Raspberry Pi 5
    - +   -> 3.3V
    - -   -> GND
    - S   -> A0 pe ADS1115 (implicit)

    ADS1115 -> Raspberry Pi 5
    - VDD -> 3.3V
    - GND -> GND
    - SDA -> GPIO2 / SDA1
    - SCL -> GPIO3 / SCL1
    - ADDR -> GND (adresa 0x48)

Notă: Acest senzor oferă puls (BPM), nu SpO2 real.
"""

import statistics
import time
import signal
import sys

LOG_TAG = "[PULS]"

try:
    import smbus2
    from smbus2 import i2c_msg
    import os
    HARDWARE_AVAILABLE = os.path.exists("/dev/i2c-1")
    if not HARDWARE_AVAILABLE:
        print(f"{LOG_TAG} I2C /dev/i2c-1 indisponibil - mod simulare activat")
except ImportError:
    HARDWARE_AVAILABLE = False
    print(f"{LOG_TAG} Biblioteci hardware indisponibile - mod simulare activat")

from sensor_client import SensorClient
import config as sensor_config

INTERVALS = getattr(sensor_config, "INTERVALS", {"puls": 1.0})
ADS1115 = getattr(sensor_config, "ADS1115", {})


class PulsOximeter:
    """Citire puls prin senzor analogic + ADS1115."""

    def __init__(self, debug=False, raw_only=False, hardware_test=False, no_send=False):
        self.client = SensorClient("puls")
        self.running = False
        self.hardware_available = HARDWARE_AVAILABLE
        self.debug = debug
        self.raw_only = raw_only
        self.hardware_test = hardware_test
        self.no_send = no_send

        self.channel = ADS1115.get("pulse_channel", 0)
        self.i2c_bus = ADS1115.get("bus", 1)
        self.address = ADS1115.get("address", 0x48)
        self.pga = str(ADS1115.get("pga", "1.024"))
        self.pga_levels = ["6.144", "4.096", "2.048", "1.024", "0.512", "0.256"]
        self.data_rate = int(ADS1115.get("data_rate", 475))
        self.sample_rate_hz = int(ADS1115.get("pulse_sample_rate_hz", 75))
        self.sample_period = 1.0 / self.sample_rate_hz
        self.conversion_delay = max(0.0035, 1.25 / max(8, self.data_rate))
        self.last_raw_value = None
        self.settle_until = 0.0
        self.settle_seconds = 1.6
        self.glitch_step_threshold = 700
        self.glitch_step_confirmations = 2
        self._large_step_streak = 0
        self.rail_margin = 12

        self.samples = []
        self.max_samples = self.sample_rate_hz * 14
        self.last_sent = 0
        self.min_signal_span = 4
        self.max_signal_span = 1800
        self.estimate_window_seconds = 6
        self.bpm_history = []
        self.smoothed_bpm = None
        self.last_valid_bpm = None
        self.last_valid_bpm_at = 0.0
        self.prediction_hold_seconds = 6.0
        self.max_prediction_drift_per_sec = 1.2
        self.min_publish_confidence = 48
        self.reacquire_after_seconds = 8.0
        self.reacquire_min_confidence = 60
        self.reacquire_active = False
        self.stable_publish_delay_seconds = 1.2
        self.stable_since = 0.0
        self.last_reported_bpm = None
        self.same_bpm_count = 0
        self.valid_bpm_window = []
        self.high_bpm_candidate_count = 0
        self.transition_candidate_bpm = None
        self.transition_candidate_count = 0
        self.max_unconfirmed_delta = 6.5
        self.max_bpm_rise_step = 3.2
        self.max_bpm_fall_step = 7.0
        self.min_bpm = 42.0
        self.max_bpm = 120.0
        self.max_bpm_when_low_span = 96.0
        self.low_span_guard_threshold = 95.0
        self.max_bpm_when_low_energy = 96.0
        self.low_energy_ratio_threshold = 0.06
        self.low_energy_absolute_threshold = 11.0
        self.max_reliable_span_for_publish = 520.0
        self.max_span_hard_reject = 900.0
        self.min_peak_distance = 0.42
        self.finger_latch_until = 0.0
        self.finger_release_delay = 2.5
        self.motion_freeze_until = 0.0
        self.motion_hold_seconds = 0.28
        self.motion_debounce_required = 2
        self.motion_debounce_interval_seconds = 0.35
        self._motion_streak = 0
        self._motion_confirmed = False
        self._motion_last_update_at = 0.0
        self.auto_pga_cooldown_until = 0.0
        self.low_span_since = 0.0
        self.low_span_threshold_for_gain = 3.0
        self.low_span_gain_wait_seconds = 2.5

        if self.hardware_available:
            try:
                self.bus = smbus2.SMBus(self.i2c_bus)
                self.address = self._probe_ads1115(self.address)
                print(
                    f"{LOG_TAG} ADS1115 detectat pe I2C-{self.i2c_bus} "
                    f"addr 0x{self.address:02X}, canal A{self.channel}, "
                    f"PGA={self.pga}V, DR={self.data_rate}SPS"
                )
            except Exception as e:
                self.hardware_available = False
                print(f"{LOG_TAG} Eroare inițializare ADS1115: {e}. Mod simulare activat.")

    @staticmethod
    def _swap16(value):
        return ((value & 0xFF) << 8) | ((value >> 8) & 0xFF)

    def _probe_ads1115(self, preferred_addr):
        """Verifică adresa ADS1115 configurată; fallback pe adresele uzuale."""
        candidates = [preferred_addr, 0x49, 0x4A, 0x4B]
        seen = set()
        ordered = []
        for addr in candidates:
            if addr not in seen:
                ordered.append(addr)
                seen.add(addr)

        for addr in ordered:
            try:
                write = i2c_msg.write(addr, [0x01])
                read = i2c_msg.read(addr, 2)
                self.bus.i2c_rdwr(write, read)
                return addr
            except Exception:
                continue

        raise RuntimeError(
            "ADS1115 nu răspunde pe I2C (0x48-0x4B). "
            "Verifică SDA/SCL și pinul ADDR legat la GND."
        )

    def _read_adc(self, channel):
        """Citește un canal ADS1115 (A0-A3), rezultat 0..4095 aproximativ."""
        mux_map = {0: 0x4000, 1: 0x5000, 2: 0x6000, 3: 0x7000}
        mux = mux_map.get(channel, 0x4000)

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
        pga_bits = pga_map.get(self.pga, 0x0600)
        dr_bits = dr_map.get(self.data_rate, 0x00C0)

        config = (
            0x8000 |  # OS: start single conversion
            mux |     # MUX: AINx vs GND
            pga_bits |
            0x0100 |  # MODE: single-shot
            dr_bits |
            0x0003    # Comparator disabled
        )

        self.bus.write_word_data(self.address, 0x01, self._swap16(config))
        time.sleep(self.conversion_delay)

        raw = self._swap16(self.bus.read_word_data(self.address, 0x00))
        if raw & 0x8000:
            raw -= 1 << 16

        scaled = int((max(0, raw) / 32767.0) * 4095)
        return max(0, min(4095, scaled))

    @staticmethod
    def _percentile(values, fraction):
        if not values:
            return 0.0

        ordered = sorted(values)
        if len(ordered) == 1:
            return float(ordered[0])

        index = (len(ordered) - 1) * fraction
        lower = int(index)
        upper = min(len(ordered) - 1, lower + 1)
        weight = index - lower
        return ordered[lower] + (ordered[upper] - ordered[lower]) * weight

    @staticmethod
    def _moving_average(values, window_size):
        if not values:
            return []

        window_size = max(1, int(window_size))
        averaged = []
        running_sum = 0.0

        for index, value in enumerate(values):
            running_sum += value
            if index >= window_size:
                running_sum -= values[index - window_size]
            span = min(index + 1, window_size)
            averaged.append(running_sum / span)

        return averaged

    def _signal_metrics(self, values):
        if not values:
            return {
                "span": 0.0,
                "median": 0.0,
                "mad": 0.0,
                "clipped_high": 0,
                "clipped_low": 0,
            }

        median_value = statistics.median(values)
        mad = statistics.median(abs(value - median_value) for value in values)
        span = self._percentile(values, 0.92) - self._percentile(values, 0.08)
        return {
            "span": span,
            "median": median_value,
            "mad": mad,
            "clipped_high": sum(1 for value in values if value >= 4070),
            "clipped_low": sum(1 for value in values if value <= 20),
        }

    def _signal_stability(self, values):
        if len(values) < max(8, int(self.sample_rate_hz * 0.6)):
            return {
                "moving": False,
                "baseline_drift": 0.0,
                "diff_p90": 0.0,
                "pulsatile_energy": 0.0,
            }

        metrics = self._signal_metrics(values)
        smooth = self._moving_average(values, max(3, int(self.sample_rate_hz * 0.08)))
        baseline = self._moving_average(smooth, max(5, int(self.sample_rate_hz * 0.6)))
        residual = [signal - trend for signal, trend in zip(smooth, baseline)]
        diffs = [abs(values[index] - values[index - 1]) for index in range(1, len(values))]

        baseline_drift = self._percentile(baseline, 0.9) - self._percentile(baseline, 0.1)
        diff_p90 = self._percentile(diffs, 0.9) if diffs else 0.0
        pulsatile_energy = statistics.median(abs(value) for value in residual)

        drift_limit = max(220.0, metrics["span"] * 1.05, pulsatile_energy * 10.0)
        diff_limit = max(150.0, pulsatile_energy * 11.0, metrics["span"] * 0.45)
        severe_drift = baseline_drift > max(340.0, metrics["span"] * 1.8, pulsatile_energy * 15.0)
        severe_diff = diff_p90 > max(260.0, pulsatile_energy * 16.0, metrics["span"] * 0.75)

        moving = (
            severe_drift or
            severe_diff or
            (baseline_drift > drift_limit and diff_p90 > diff_limit)
        )

        return {
            "moving": moving,
            "baseline_drift": baseline_drift,
            "diff_p90": diff_p90,
            "pulsatile_energy": pulsatile_energy,
        }

    def _update_motion_state(self, moving, now):
        """Debounce pentru artefactele de mișcare.

        Semnalul analogic poate avea ocazional o singură fereastră (1-2s) cu drift/step mare
        fără să fie o mișcare reală. Debounce reduce aceste false-positive.
        """

        if self._motion_last_update_at > 0 and (now - self._motion_last_update_at) < self.motion_debounce_interval_seconds:
            return self._motion_confirmed

        self._motion_last_update_at = now

        if moving:
            self._motion_streak = min(self.motion_debounce_required + 1, self._motion_streak + 1)
        else:
            self._motion_streak = max(0, self._motion_streak - 1)

        if not self._motion_confirmed and self._motion_streak >= self.motion_debounce_required:
            self._motion_confirmed = True
            self.motion_freeze_until = max(self.motion_freeze_until, now + self.motion_hold_seconds)
        elif self._motion_confirmed and self._motion_streak == 0:
            self._motion_confirmed = False

        return self._motion_confirmed

    def _diagnose_recent_signal(self, values):
        if not values:
            return ""

        metrics = self._signal_metrics(values)
        median_level = metrics["median"]
        clipped_ratio_high = metrics["clipped_high"] / len(values)
        clipped_ratio_low = metrics["clipped_low"] / len(values)

        if clipped_ratio_high > 0.9 or median_level > 4020:
            return " | diagnostic: intrarea A0 este aproape lipita sus; verifica V+, S->A0 si masa comuna"
        if clipped_ratio_low > 0.9 or median_level < 15:
            return " | diagnostic: intrarea A0 este aproape lipita jos; verifica GND si pinul S"
        if metrics["span"] < 4 and 80 <= median_level <= 4015:
            return " | diagnostic: ADS1115 raspunde, dar semnalul este aproape plat; problema e mai probabil la senzor/deget decat la convertor"
        if metrics["span"] < self.min_signal_span and 80 <= median_level <= 4015:
            return " | diagnostic: convertorul vede semnal, dar pulsul este prea slab; apasa usor, acopera complet LED-ul si verifica firele"

        return ""

    def _hardware_test_status(self, values):
        metrics = self._signal_metrics(values)
        stability = self._signal_stability(values)
        median_level = metrics["median"]

        if metrics["clipped_low"] > len(values) * 0.8:
            return "A0 blocat jos - verifica GND si firul S"
        if metrics["clipped_high"] > len(values) * 0.8 or median_level > 4020:
            return "A0 blocat sus - verifica 3.3V, S si masa comuna"
        if metrics["span"] < 4:
            return "Semnal aproape plat - ADS1115 merge, dar senzorul nu vede puls"
        if stability["moving"]:
            return "Semnal instabil - miscare, contact slab sau zgomot pe fire"
        if metrics["span"] > self.max_span_hard_reject:
            return "Amplitudine extrema - contact instabil sau saturatie"
        if metrics["span"] < 50:
            return "Semnal slab - apasa usor si acopera complet LED-ul"
        return "Semnal utilizabil pentru diagnostic"

    def run_hardware_test(self):
        """Diagnostic simplu pentru senzor si ADS1115 fara estimare BPM."""
        self.running = True
        print(f"{LOG_TAG} Mod hardware-test pornit. Nu trimite date la server.")
        print(f"{LOG_TAG} Urmareste RAW, SPAN si STATUS pentru a verifica senzorul si cablarea.")

        while self.running:
            loop_start = time.time()
            try:
                if self.hardware_available:
                    raw_value = self._read_adc(self.channel)
                else:
                    _, raw_value = self._simulate_reading()

                self.samples.append((loop_start, raw_value))
                if len(self.samples) > self.max_samples:
                    self.samples = self.samples[-self.max_samples:]

                if (loop_start - self.last_sent) >= 1.0:
                    self.last_sent = loop_start
                    recent = [value for _, value in self.samples[-self.sample_rate_hz:]] or [raw_value]
                    metrics = self._signal_metrics(recent)
                    stability = self._signal_stability(recent)
                    status = self._hardware_test_status(recent)
                    print(
                        f"{LOG_TAG}[TEST] "
                        f"RAW={raw_value} | SPAN={round(metrics['span'])} | "
                        f"MEDIAN={int(metrics['median'])} | MAD={metrics['mad']:.1f} | "
                        f"DRIFT={stability['baseline_drift']:.1f} | STEP={stability['diff_p90']:.1f} | "
                        f"STATUS: {status}"
                    )

                elapsed = time.time() - loop_start
                sleep_time = self.sample_period - elapsed
                if sleep_time > 0:
                    time.sleep(sleep_time)
            except KeyboardInterrupt:
                break
            except Exception as e:
                print(f"{LOG_TAG}[TEST] Eroare: {e}")
                time.sleep(0.5)

        self.stop()

    def _confidence_score(self, metrics, stability, bpm, quality_ok):
        score = 100.0
        min_energy = max(self.low_energy_absolute_threshold, metrics["span"] * self.low_energy_ratio_threshold)

        if not quality_ok:
            score -= 35.0
        if bpm is None:
            score -= 18.0
        if stability["moving"]:
            score -= 40.0

        score -= min(20.0, stability["baseline_drift"] / 20.0)
        score -= min(20.0, stability["diff_p90"] / 25.0)

        if metrics["span"] < 20:
            score -= 20.0
        elif metrics["span"] < 40:
            score -= 13.0
        elif metrics["span"] < 80:
            score -= 8.0
        elif metrics["span"] > self.max_reliable_span_for_publish:
            score -= 24.0

        if stability["pulsatile_energy"] < min_energy:
            score -= 24.0
        elif stability["pulsatile_energy"] < (min_energy * 1.35):
            score -= 12.0

        if metrics["clipped_high"] > 0 or metrics["clipped_low"] > 0:
            score -= 15.0

        return max(0, min(100, round(score)))

    def _debug_suffix(self, metrics, stability, confidence):
        return (
            f" | conf={confidence}%"
            f" | median={int(metrics['median'])}"
            f" | mad={metrics['mad']:.1f}"
            f" | drift={stability['baseline_drift']:.1f}"
            f" | step={stability['diff_p90']:.1f}"
            f" | energy={stability['pulsatile_energy']:.1f}"
        )

    def _apply_high_bpm_spike_guard(self, bpm, span, stability, confidence):
        if bpm is None:
            return None, ""

        min_energy = max(self.low_energy_absolute_threshold, span * self.low_energy_ratio_threshold)

        if span > self.max_span_hard_reject:
            self.high_bpm_candidate_count = 0
            return None, f" | amplitudine extrema (SPAN={span}), invalidam bpm"

        if span > self.max_reliable_span_for_publish and confidence < 88:
            self.high_bpm_candidate_count = 0
            return None, f" | amplitudine mare (SPAN={span}), asteptam stabilizare"

        if span < self.low_span_guard_threshold and bpm > self.max_bpm_when_low_span:
            self.high_bpm_candidate_count = 0
            return (
                None,
                f" | bpm mare pe amplitudine mica (SPAN={span}), folosim predictie",
            )

        if stability["pulsatile_energy"] < min_energy and bpm > self.max_bpm_when_low_energy:
            self.high_bpm_candidate_count = 0
            return (
                None,
                f" | bpm mare pe energie puls slaba ({stability['pulsatile_energy']:.1f}), folosim predictie",
            )

        if len(self.valid_bpm_window) < 5:
            return bpm, ""

        baseline = statistics.median(self.valid_bpm_window[-12:])
        high_jump = bpm - baseline
        looks_noisy = (
            stability["moving"] or
            confidence < 78 or
            span < 90 or
            span > 360
        )

        if high_jump >= 12.0:
            if looks_noisy:
                self.high_bpm_candidate_count = 0
                return None, f" | spike suspect peste baseline ({baseline:.1f}), folosim predictie"

            self.high_bpm_candidate_count += 1
            if self.high_bpm_candidate_count < 3:
                return None, f" | crestere mare in verificare ({baseline:.1f} -> {bpm:.1f})"
        else:
            self.high_bpm_candidate_count = 0

        return bpm, ""

    def _apply_transition_guard(self, bpm, span, stability, confidence):
        if bpm is None:
            return None, ""

        if len(self.valid_bpm_window) < 5:
            return bpm, ""

        baseline = statistics.median(self.valid_bpm_window[-10:])
        delta = bpm - baseline
        if abs(delta) < self.max_unconfirmed_delta:
            self.transition_candidate_bpm = None
            self.transition_candidate_count = 0
            return bpm, ""

        looks_uncertain = (
            stability["moving"] or
            confidence < 82 or
            span < 110 or
            span > 450
        )
        if looks_uncertain:
            self.transition_candidate_bpm = None
            self.transition_candidate_count = 0
            return None, f" | salt mare fata de baseline ({baseline:.1f}), asteptam stabilizare"

        if self.transition_candidate_bpm is not None and abs(self.transition_candidate_bpm - bpm) <= 3.0:
            self.transition_candidate_count += 1
        else:
            self.transition_candidate_bpm = bpm
            self.transition_candidate_count = 1

        if self.transition_candidate_count < 2:
            return None, f" | tranzitie in verificare ({baseline:.1f} -> {bpm:.1f})"

        self.transition_candidate_bpm = None
        self.transition_candidate_count = 0
        return bpm, ""

    def _should_reacquire(self, now, span, stability, confidence):
        if self.reacquire_active:
            return (
                not stability["moving"] and
                self.min_signal_span <= span <= 420 and
                confidence >= max(55, self.reacquire_min_confidence - 10)
            )

        if self.last_valid_bpm_at <= 0:
            return False

        if (now - self.last_valid_bpm_at) < self.reacquire_after_seconds:
            return False

        return (
            not stability["moving"] and
            self.min_signal_span <= span <= 420 and
            confidence >= self.reacquire_min_confidence
        )

    def _reset_validation_state(self, keep_prediction=True):
        self.bpm_history = []
        self.smoothed_bpm = None
        self.last_reported_bpm = None
        self.same_bpm_count = 0
        self.stable_since = 0.0
        self.valid_bpm_window = []
        self.high_bpm_candidate_count = 0
        self.transition_candidate_bpm = None
        self.transition_candidate_count = 0
        if not keep_prediction:
            self.last_valid_bpm = None
            self.last_valid_bpm_at = 0.0

    def _predict_bpm(self, now, quality_ok, stability):
        if self.last_valid_bpm is None:
            return None

        age = now - self.last_valid_bpm_at
        if age < 0 or age > self.prediction_hold_seconds:
            return None

        if stability["moving"]:
            # În loc să tăiem complet, păstrăm foarte scurt ultima valoare bună
            # (doar pentru afișare locală; nu publicăm către server).
            if age <= 1.5:
                return round(self.last_valid_bpm, 1)
            return None

        trend = 0.0
        if len(self.bpm_history) >= 2:
            trend = self.bpm_history[-1] - self.bpm_history[-2]
        trend = max(-self.max_prediction_drift_per_sec, min(self.max_prediction_drift_per_sec, trend))

        predicted = self.last_valid_bpm + (trend * min(age, 1.5))
        predicted = max(self.min_bpm, min(self.max_bpm, predicted))
        return round(predicted, 1)

    @staticmethod
    def _interval_stats(intervals):
        if len(intervals) < 2:
            return None

        median_interval = statistics.median(intervals)
        filtered = [
            value for value in intervals
            if (median_interval * 0.72) <= value <= (median_interval * 1.28)
        ]
        if len(filtered) >= 2:
            intervals = filtered

        # Mean robust: intervale false prea scurte pot trage media în jos -> BPM supraestimat.
        # Folosim o medie "trimmed" când avem suficiente intervale.
        ordered = sorted(intervals)
        if len(ordered) >= 5:
            trim = max(1, int(len(ordered) * 0.2))
            core = ordered[trim:-trim] if (len(ordered) - 2 * trim) >= 2 else ordered
        else:
            core = ordered

        mean_interval = statistics.fmean(core)
        if mean_interval <= 0:
            return None

        variability = 0.0
        if len(core) >= 3:
            variability = statistics.pstdev(core) / mean_interval

        return intervals, mean_interval, variability

    def _estimate_bpm_autocorr(self, bandpassed):
        if len(bandpassed) < int(self.sample_rate_hz * 2):
            return None, 0.0

        centered = [value - statistics.fmean(bandpassed) for value in bandpassed]
        energy = sum(value * value for value in centered)
        if energy <= 1e-6:
            return None, 0.0

        min_lag = max(1, int(self.sample_rate_hz * (60.0 / self.max_bpm)))
        max_lag = min(len(centered) - 2, int(self.sample_rate_hz * (60.0 / self.min_bpm)))
        if min_lag >= max_lag:
            return None, 0.0

        best_lag = None
        best_corr = -1.0
        corr_by_lag = {}
        for lag in range(min_lag, max_lag + 1):
            segment_len = len(centered) - lag
            if segment_len < int(self.sample_rate_hz * 1.5):
                continue

            numerator = 0.0
            lhs_energy = 0.0
            rhs_energy = 0.0
            for index in range(segment_len):
                left = centered[index]
                right = centered[index + lag]
                numerator += left * right
                lhs_energy += left * left
                rhs_energy += right * right

            denom = (lhs_energy * rhs_energy) ** 0.5
            if denom <= 1e-6:
                continue

            corr = numerator / denom
            corr_by_lag[lag] = corr
            if corr > best_corr:
                best_corr = corr
                best_lag = lag

        if best_lag is None or best_corr < 0.22:
            return None, max(0.0, best_corr)

        bpm = 60.0 * self.sample_rate_hz / best_lag

        # Guard armonici: uneori autocorelația preferă un lag prea mic (BPM prea mare)
        # dacă există o componentă periodică secundară. Dacă 2x lag are corelație apropiată,
        # preferăm BPM-ul mai mic, mai ales dacă se potrivește cu ultima valoare validă.
        harmonic_lag = best_lag * 2
        if harmonic_lag in corr_by_lag:
            harmonic_corr = corr_by_lag[harmonic_lag]
            if harmonic_corr >= (best_corr - 0.03) and harmonic_corr >= 0.20:
                harmonic_bpm = 60.0 * self.sample_rate_hz / harmonic_lag
                choose_harmonic = False
                if self.last_valid_bpm is not None:
                    if abs(harmonic_bpm - self.last_valid_bpm) <= max(4.0, abs(bpm - self.last_valid_bpm) - 2.0):
                        choose_harmonic = True
                else:
                    if bpm >= 92.0 and 45.0 <= harmonic_bpm <= 105.0:
                        choose_harmonic = True
                if choose_harmonic:
                    bpm = harmonic_bpm
                    best_corr = max(best_corr, harmonic_corr)

        bpm = max(self.min_bpm, min(self.max_bpm, bpm))
        return bpm, best_corr

    def _estimate_bpm(self):
        """Estimare BPM cu filtrare adaptivă pentru semnale analogice zgomotoase."""
        min_samples = self.sample_rate_hz * 3
        if len(self.samples) < min_samples:
            return None

        window = self.samples[-self.sample_rate_hz * self.estimate_window_seconds:]
        timestamps = [timestamp for timestamp, _ in window]
        values = [value for _, value in window]
        metrics = self._signal_metrics(values)
        if metrics["span"] < self.min_signal_span:
            return None

        stability = self._signal_stability(values[-self.sample_rate_hz * 2:])
        now = timestamps[-1]
        motion_confirmed = self._update_motion_state(stability["moving"], now)
        if motion_confirmed:
            return None

        if now <= self.motion_freeze_until:
            return None

        smooth = self._moving_average(values, max(3, int(self.sample_rate_hz * 0.08)))
        baseline = self._moving_average(smooth, max(5, int(self.sample_rate_hz * 0.75)))
        bandpassed = [signal - trend for signal, trend in zip(smooth, baseline)]

        if abs(min(bandpassed)) > abs(max(bandpassed)):
            bandpassed = [-value for value in bandpassed]

        envelope = self._moving_average(
            [abs(value) for value in bandpassed],
            max(3, int(self.sample_rate_hz * 0.18)),
        )
        # Percentil inferior în loc de mediană: pragurile nu mai "sar" în sus
        # când apare un spike rar (mișcare/contact imperfect).
        envelope_floor = self._percentile(envelope, 0.30) if envelope else 0.0
        noise_floor = max(0.8, envelope_floor)
        # Când SPAN e mic, un prag prea permisiv poate număra "zgomot" drept vârfuri -> BPM prea mare.
        low_span_scale = 1.0
        if metrics["span"] < 90:
            low_span_scale = 1.12

        peak_threshold = max(noise_floor * 1.35 * low_span_scale, metrics["span"] * 0.03)
        prominence_threshold = max(noise_floor * 0.58 * low_span_scale, metrics["span"] * 0.014)
        search_radius = max(3, int(self.sample_rate_hz * 0.16))
        min_interval = max(self.min_peak_distance, 60.0 / self.max_bpm)
        max_interval = 60.0 / self.min_bpm

        def find_peak_candidates(cur_peak_threshold, cur_prominence_threshold, cur_search_radius):
            candidates = []
            for index in range(1, len(bandpassed) - 1):
                current_value = bandpassed[index]
                if current_value <= cur_peak_threshold:
                    continue
                if current_value < bandpassed[index - 1] or current_value < bandpassed[index + 1]:
                    continue

                left = max(0, index - cur_search_radius)
                right = min(len(bandpassed), index + cur_search_radius + 1)
                local_min = min(bandpassed[left:right])
                prominence = current_value - local_min
                if prominence < cur_prominence_threshold:
                    continue

                candidates.append((timestamps[index], current_value, prominence))
            return candidates

        peak_candidates = find_peak_candidates(peak_threshold, prominence_threshold, search_radius)

        # Fallback pentru semnal slab, dar stabil: praguri mai permisive
        # ca sa nu ratam pulsuri reale cu amplitudine mica.
        if len(peak_candidates) < 3 and metrics["span"] <= 220 and not motion_confirmed:
            relaxed_peak_threshold = max(noise_floor * 1.08, metrics["span"] * 0.016, 0.8)
            relaxed_prominence_threshold = max(noise_floor * 0.34, metrics["span"] * 0.007, 0.45)
            relaxed_search_radius = max(2, int(self.sample_rate_hz * 0.12))
            peak_candidates = find_peak_candidates(
                relaxed_peak_threshold,
                relaxed_prominence_threshold,
                relaxed_search_radius,
            )
        use_autocorr = False
        variability = 0.0

        if len(peak_candidates) < 3:
            autocorr_bpm, corr_quality = self._estimate_bpm_autocorr(bandpassed)
            if autocorr_bpm is None:
                return None
            bpm = autocorr_bpm
            variability = max(0.05, 0.22 - (corr_quality * 0.5))
            use_autocorr = True

        peak_times = []
        peak_strengths = []

        if not use_autocorr:
            for peak_time, peak_value, prominence in peak_candidates:
                if peak_times and (peak_time - peak_times[-1]) < min_interval:
                    if prominence > peak_strengths[-1]:
                        peak_times[-1] = peak_time
                        peak_strengths[-1] = prominence
                    continue

                peak_times.append(peak_time)
                peak_strengths.append(prominence)

            if len(peak_times) < 2:
                return None

            intervals = [peak_times[i] - peak_times[i - 1] for i in range(1, len(peak_times))]
            intervals = [value for value in intervals if min_interval <= value <= max_interval]
            if len(intervals) < 2:
                return None

            normal_stats = self._interval_stats(intervals)
            if normal_stats is None:
                return None

            chosen_intervals, mean_interval, variability = normal_stats
            bpm = 60.0 / mean_interval

            pair_intervals = [intervals[i] + intervals[i + 1] for i in range(len(intervals) - 1)]
            pair_intervals = [value for value in pair_intervals if min_interval <= value <= max_interval]
            pair_stats = self._interval_stats(pair_intervals) if len(pair_intervals) >= 2 else None

            if pair_stats is not None:
                _, pair_mean_interval, pair_variability = pair_stats
                pair_bpm = 60.0 / pair_mean_interval
                if (
                    bpm >= 95.0 and
                    45.0 <= pair_bpm <= 105.0 and
                    pair_bpm <= bpm * 0.68 and
                    pair_variability <= max(0.18, variability + 0.03)
                ):
                    chosen_intervals, mean_interval, variability = pair_stats
                    bpm = pair_bpm

            # Corectie pentru half-rate: uneori detectorul rateaza fiecare a doua bataie
            # si raporteaza BPM prea mic (aprox. jumatate din real).
            doubled_intervals = [value / 2.0 for value in intervals if min_interval <= (value / 2.0) <= max_interval]
            half_rate_stats = self._interval_stats(doubled_intervals) if len(doubled_intervals) >= 2 else None
            if half_rate_stats is not None:
                _, doubled_mean_interval, doubled_variability = half_rate_stats
                doubled_bpm = 60.0 / doubled_mean_interval
                if (
                    bpm <= 58.0 and
                    55.0 <= doubled_bpm <= 110.0 and
                    (doubled_bpm - bpm) >= 10.0 and
                    doubled_variability <= max(0.20, variability + 0.04)
                ):
                    chosen_intervals, mean_interval, variability = half_rate_stats
                    bpm = doubled_bpm

            # Cross-check cu autocorelația: dacă metoda pe vârfuri supra-numără (BPM prea mare)
            # dar autocorelația are o corelație bună, preferăm valoarea autocorr (mai stabilă).
            autocorr_bpm, corr_quality = self._estimate_bpm_autocorr(bandpassed)
            if autocorr_bpm is not None and corr_quality >= 0.28:
                overcount = bpm - autocorr_bpm
                uncertain = (variability >= 0.11) or (metrics["span"] < 130) or (metrics["mad"] > metrics["span"] * 0.30)
                if overcount >= 6.0 and uncertain:
                    if self.last_valid_bpm is None or abs(autocorr_bpm - self.last_valid_bpm) <= abs(bpm - self.last_valid_bpm) + 1.0:
                        bpm = autocorr_bpm
                        variability = max(variability, 0.10)

        if variability > 0.18:
            return None

        bpm = max(self.min_bpm, min(self.max_bpm, bpm))
        candidate_bpm = bpm

        if self.bpm_history:
            prev = self.bpm_history[-1]
            if bpm > prev + self.max_bpm_rise_step:
                bpm = prev + self.max_bpm_rise_step
            elif bpm < prev - self.max_bpm_fall_step:
                bpm = prev - self.max_bpm_fall_step

        if self.smoothed_bpm is None:
            self.smoothed_bpm = bpm
        else:
            alpha = 0.58
            if variability > 0.12:
                alpha = 0.42
            self.smoothed_bpm = (alpha * bpm) + ((1.0 - alpha) * self.smoothed_bpm)

        self.bpm_history.append(self.smoothed_bpm)
        self.bpm_history = self.bpm_history[-2:]
        bpm = statistics.fmean(self.bpm_history)

        rounded_bpm = round(bpm, 1)
        if self.last_reported_bpm is not None and abs(rounded_bpm - self.last_reported_bpm) < 0.05:
            self.same_bpm_count += 1
        else:
            self.same_bpm_count = 0

        if self.same_bpm_count >= 6 and abs(candidate_bpm - rounded_bpm) >= 1.8:
            self.smoothed_bpm = candidate_bpm
            self.bpm_history = [candidate_bpm]
            bpm = candidate_bpm
            rounded_bpm = round(bpm, 1)
            self.same_bpm_count = 0

        self.last_reported_bpm = rounded_bpm

        return rounded_bpm

    def _finger_present(self):
        """Heuristică mai tolerantă pentru detectarea degetului pe senzor."""
        min_window = int(self.sample_rate_hz * 1.5)
        if len(self.samples) < min_window:
            return False

        recent = [v for _, v in self.samples[-min_window:]]
        metrics = self._signal_metrics(recent)
        now = self.samples[-1][0]

        smooth = self._moving_average(recent, max(3, int(self.sample_rate_hz * 0.08)))
        baseline = self._moving_average(smooth, max(5, int(self.sample_rate_hz * 0.6)))
        pulsatile_energy = statistics.median(
            abs(signal - trend) for signal, trend in zip(smooth, baseline)
        )

        median_level = metrics["median"]
        clipped_ratio_high = metrics["clipped_high"] / len(recent)
        clipped_ratio_low = metrics["clipped_low"] / len(recent)
        in_adc_range = 80 <= median_level <= 4015
        has_reasonable_span = metrics["span"] >= 3
        has_pulse_energy = pulsatile_energy >= 0.28
        signal_ok = (
            has_reasonable_span and
            has_pulse_energy and
            in_adc_range and
            clipped_ratio_high <= 0.85 and
            clipped_ratio_low <= 0.85 and
            metrics["span"] <= self.max_signal_span
        )

        if signal_ok:
            self.finger_latch_until = now + self.finger_release_delay
            return True

        if now <= self.finger_latch_until and has_reasonable_span and in_adc_range:
            return True

        return False

    def _detect_glitch_reason(self, raw_value):
        near_rail = raw_value <= self.rail_margin or raw_value >= (4095 - self.rail_margin)
        if near_rail:
            self._large_step_streak = 0
            return "intrare aproape de rail"

        if self.last_raw_value is None:
            return None

        step = abs(raw_value - self.last_raw_value)
        if step >= self.glitch_step_threshold:
            self._large_step_streak += 1
            if self._large_step_streak >= self.glitch_step_confirmations:
                self._large_step_streak = 0
                return "salt brut repetat"
            return None

        self._large_step_streak = 0

        return None

    def _enter_settle_mode(self, now):
        self.settle_until = max(self.settle_until, now + self.settle_seconds)
        self._reset_validation_state(keep_prediction=True)
        self.reacquire_active = False
        self.finger_latch_until = 0.0
        keep = max(int(self.sample_rate_hz * 1.5), 1)
        self.samples = self.samples[-keep:]

    def _auto_adjust_pga(self, metrics, recent_count, now):
        if now < self.auto_pga_cooldown_until:
            return ""

        if recent_count <= 0:
            return ""

        clipped_high_ratio = metrics["clipped_high"] / recent_count
        clipped_low_ratio = metrics["clipped_low"] / recent_count
        near_rail = clipped_high_ratio >= 0.92 or clipped_low_ratio >= 0.92

        if self.pga not in self.pga_levels:
            return ""

        idx = self.pga_levels.index(self.pga)

        if near_rail:
            self.low_span_since = 0.0
            if idx == 0:
                return ""
            old_pga = self.pga
            self.pga = self.pga_levels[idx - 1]
            self.auto_pga_cooldown_until = now + 3.0
            self._enter_settle_mode(now)
            return f" | auto-PGA: {old_pga} -> {self.pga} pentru a evita saturatia"

        # Dacă semnalul rămâne aproape plat câteva secunde fără clipping,
        # creștem gradual sensibilitatea ca să captăm pulsuri foarte mici.
        low_span = metrics["span"] <= self.low_span_threshold_for_gain
        no_clipping = clipped_high_ratio <= 0.02 and clipped_low_ratio <= 0.02
        in_mid_range = 120 <= metrics["median"] <= 3975

        if low_span and no_clipping and in_mid_range:
            if self.low_span_since <= 0.0:
                self.low_span_since = now
            elif (now - self.low_span_since) >= self.low_span_gain_wait_seconds:
                if idx < (len(self.pga_levels) - 1):
                    old_pga = self.pga
                    self.pga = self.pga_levels[idx + 1]
                    self.auto_pga_cooldown_until = now + 3.0
                    self.low_span_since = 0.0
                    self._enter_settle_mode(now)
                    return f" | auto-PGA: {old_pga} -> {self.pga} pentru semnal prea plat"
        else:
            self.low_span_since = 0.0

        return ""

    def _stable_publish_ready(self, now, quality_ok, stability, confidence, span):
        low_span_clean_mode = (
            not stability["moving"] and
            self.min_signal_span <= span < 80 and
            confidence >= max(40, self.min_publish_confidence - 10)
        )

        stable_conditions = (
            quality_ok and
            not stability["moving"] and
            confidence >= self.min_publish_confidence and
            span <= self.max_reliable_span_for_publish
        )

        if low_span_clean_mode:
            stable_conditions = True

        if not stable_conditions:
            self.stable_since = 0.0
            return False, 0.0

        if self.stable_since <= 0.0:
            self.stable_since = now

        stable_for = now - self.stable_since
        required_seconds = self.stable_publish_delay_seconds
        if low_span_clean_mode:
            required_seconds = max(0.8, self.stable_publish_delay_seconds - 0.3)

        return stable_for >= required_seconds, stable_for

    def _simulate_reading(self):
        """Date simulate pentru testare fără hardware."""
        import random
        import math

        t = time.time()
        base_hr = 75
        hr = base_hr + 5 * math.sin(t * 0.1) + random.gauss(0, 1)
        hr = max(55, min(110, hr))

        raw = 2100 + int(240 * math.sin(t * 7.8)) + int(random.gauss(0, 20))
        raw = max(0, min(4095, raw))
        return round(hr, 1), raw

    def start(self, pacient_id=None):
        """Pornește citirea senzorului de puls."""
        if self.hardware_test:
            return self.run_hardware_test()

        self.running = True
        if not self.no_send:
            self.client.connect_to_server()
        else:
            print(f"{LOG_TAG} --no-send activ: nu trimite date la server")

        print(f"{LOG_TAG} Citire pornită. CTRL+C pentru oprire.")

        while self.running:
            loop_start = time.time()
            try:
                if self.hardware_available:
                    raw_value = self._read_adc(self.channel)
                    self.samples.append((loop_start, raw_value))
                    if len(self.samples) > self.max_samples:
                        self.samples = self.samples[-self.max_samples:]

                    glitch_reason = self._detect_glitch_reason(raw_value)
                    self.last_raw_value = raw_value
                    if glitch_reason is not None:
                        self._enter_settle_mode(loop_start)
                        bpm = None
                    elif loop_start <= self.settle_until:
                        bpm = None
                    elif self._finger_present():
                        bpm = self._estimate_bpm()
                    else:
                        bpm = None
                        self._reset_validation_state(keep_prediction=True)
                        self.reacquire_active = False
                        self.finger_latch_until = 0.0
                        # Păstrează fereastra minimă necesară pentru a putea reintra rapid
                        # în starea "deget prezent" când semnalul revine.
                        keep = self.sample_rate_hz * 5
                        self.samples = self.samples[-keep:]
                else:
                    bpm, raw_value = self._simulate_reading()
                    glitch_reason = None

                if (loop_start - self.last_sent) >= INTERVALS["puls"]:
                    self.last_sent = loop_start
                    recent = [v for _, v in self.samples[-self.sample_rate_hz:]] if self.samples else [raw_value]
                    metrics = self._signal_metrics(recent)
                    stability = self._signal_stability(recent)
                    motion_confirmed = self._update_motion_state(stability["moving"], loop_start)
                    stability_gate = dict(stability)
                    stability_gate["moving"] = motion_confirmed
                    pga_note = self._auto_adjust_pga(metrics, len(recent), loop_start)
                    diagnostic_note = self._diagnose_recent_signal(recent)
                    span = round(metrics["span"])
                    clipped_high = metrics["clipped_high"]
                    clipped_low = metrics["clipped_low"]
                    quality_ok = (
                        self.min_signal_span <= span <= self.max_signal_span and
                        clipped_high <= len(recent) * 0.65 and
                        clipped_low <= len(recent) * 0.65
                    )
                    weak_stable_mode = (
                        not motion_confirmed and
                        24 <= span <= self.max_signal_span and
                        clipped_high <= len(recent) * 0.85 and
                        clipped_low <= len(recent) * 0.85
                    )
                    quality_note = ""
                    if clipped_high > len(recent) * 0.6:
                        quality_note = " | ATENȚIE: semnal saturat sus (verifică V+/S/A0)"
                    elif clipped_low > len(recent) * 0.6:
                        quality_note = " | ATENȚIE: semnal saturat jos (verifică GND/S/A0)"
                    elif motion_confirmed:
                        quality_note = " | artefact de miscare (tine degetul si firele complet nemiscate)"
                    elif span > self.max_span_hard_reject:
                        quality_note = " | amplitudine extrema (probabil contact instabil sau saturatie)"
                    elif span > self.max_reliable_span_for_publish:
                        quality_note = " | amplitudine foarte mare, asteptam stabilizare"
                    elif span < self.min_signal_span:
                        quality_note = " | semnal prea slab (apasă mai ferm, acoperă LED-ul și ține degetul nemișcat)"
                    elif bpm is None and span >= max(20, self.min_signal_span * 3):
                        quality_note = " | semnal prezent, dar algoritmul inca strange suficiente batai valide"

                    if glitch_reason is not None:
                        quality_note = f"{quality_note} | glitch detectat ({glitch_reason}), asteptam stabilizare"
                    elif loop_start <= self.settle_until:
                        quality_note = f"{quality_note} | in stabilizare dupa zgomot puternic"

                    if diagnostic_note and diagnostic_note not in quality_note:
                        quality_note = f"{quality_note}{diagnostic_note}"
                    if pga_note:
                        quality_note = f"{quality_note}{pga_note}"

                    in_settle = loop_start <= self.settle_until
                    if in_settle:
                        quality_ok = False
                        bpm = None
                        self.reacquire_active = False

                    if not quality_ok:
                        bpm = None
                        if not weak_stable_mode:
                            self._reset_validation_state(keep_prediction=True)
                            self.reacquire_active = False
                        else:
                            quality_note = f"{quality_note} | semnal slab dar stabil, mentinem continuitatea"

                    if motion_confirmed:
                        bpm = None
                        self.reacquire_active = False

                    predicted_bpm = self._predict_bpm(loop_start, quality_ok, stability_gate)
                    confidence = self._confidence_score(metrics, stability_gate, bpm, quality_ok)
                    debug_suffix = self._debug_suffix(metrics, stability, confidence) if self.debug else ""
                    confidence_ok = confidence >= self.min_publish_confidence
                    reacquire_mode = self._should_reacquire(loop_start, span, stability_gate, confidence)

                    if reacquire_mode and not self.reacquire_active:
                        self.reacquire_active = True
                        self._reset_validation_state(keep_prediction=True)
                        quality_note = f"{quality_note} | reintrare automata in calibrare"
                    elif not reacquire_mode:
                        self.reacquire_active = False

                    if bpm is not None and not confidence_ok and not reacquire_mode:
                        quality_note = f"{quality_note} | incredere scazuta ({confidence}%), folosim predictie"
                        bpm = None

                    if not reacquire_mode:
                        bpm, spike_note = self._apply_high_bpm_spike_guard(bpm, span, stability_gate, confidence)
                        if spike_note:
                            quality_note = f"{quality_note}{spike_note}"

                        bpm, transition_note = self._apply_transition_guard(bpm, span, stability_gate, confidence)
                        if transition_note:
                            quality_note = f"{quality_note}{transition_note}"

                    publish_ready, stable_for = self._stable_publish_ready(
                        loop_start,
                        quality_ok,
                        stability_gate,
                        confidence,
                        span,
                    )
                    if bpm is not None and not publish_ready:
                        bpm = None
                        if stable_for > 0:
                            quality_note = (
                                f"{quality_note} | stabilizare semnal {stable_for:.1f}/"
                                f"{self.stable_publish_delay_seconds:.1f}s"
                            )

                    if self.raw_only:
                        status = "OK" if quality_ok and not motion_confirmed else "NOISY"
                        print(
                            f"{LOG_TAG} RAW: {raw_value} | SPAN: {span} | STATUS: {status}"
                            f"{quality_note}{debug_suffix}"
                        )
                        continue

                    if bpm is not None:
                        self.reacquire_active = False
                        self.last_valid_bpm = bpm
                        self.last_valid_bpm_at = loop_start
                        self.valid_bpm_window.append(bpm)
                        self.valid_bpm_window = self.valid_bpm_window[-20:]
                        if not self.no_send:
                            self.client.send_reading(
                                value_1=bpm,
                                value_2=None,
                                pacient_id=pacient_id,
                            )
                        if self.debug:
                            print(f"{LOG_TAG} RAW: {raw_value} | SPAN: {span} | BPM: {bpm:.1f}{quality_note}{debug_suffix}")
                        else:
                            print(f"{LOG_TAG} RAW: {raw_value} | SPAN: {span} | BPM: {bpm:.1f}")
                    elif predicted_bpm is not None:
                        if self.debug:
                            print(
                                f"{LOG_TAG} RAW: {raw_value} | SPAN: {span} | BPM: {predicted_bpm:.1f}"
                                f"{quality_note} | predictie scurta{debug_suffix}"
                            )
                        else:
                            print(f"{LOG_TAG} RAW: {raw_value} | SPAN: {span} | BPM: {predicted_bpm:.1f}")
                    else:
                        if self.debug:
                            print(f"{LOG_TAG} RAW: {raw_value} | SPAN: {span} | BPM: -- (semnal slab/fără deget){quality_note}{debug_suffix}")
                        else:
                            print(f"{LOG_TAG} RAW: {raw_value} | SPAN: {span} | BPM: --")

                elapsed = time.time() - loop_start
                sleep_time = self.sample_period - elapsed
                if sleep_time > 0:
                    time.sleep(sleep_time)

            except KeyboardInterrupt:
                break
            except Exception as e:
                print(f"{LOG_TAG} Eroare: {e}")
                time.sleep(0.5)

        self.stop()

    def stop(self):
        """Oprește citirea."""
        self.running = False
        if self.hardware_available:
            self.bus.close()
        self.client.disconnect_from_server()
        print(f"{LOG_TAG} Oprit.")


def main():
    import argparse
    parser = argparse.ArgumentParser(description="Citire puls analogic via ADS1115")
    parser.add_argument("--pacient", type=int, help="ID-ul pacientului monitorizat")
    parser.add_argument("--debug", action="store_true", help="Afișează metrici de calitate pentru diagnostic")
    parser.add_argument("--raw-only", action="store_true", help="Afișează doar semnalul brut și starea de calitate")
    parser.add_argument("--hardware-test", action="store_true", help="Rulează diagnostic hardware fără estimare BPM și fără trimitere la server")
    parser.add_argument("--no-send", action="store_true", help="Nu trimite citiri la server (doar afișare locală)")
    args = parser.parse_args()

    sensor = PulsOximeter(
        debug=args.debug,
        raw_only=args.raw_only,
        hardware_test=args.hardware_test,
        no_send=args.no_send,
    )

    def signal_handler(sig, frame):
        sensor.stop()
        sys.exit(0)

    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)

    sensor.start(pacient_id=args.pacient)


if __name__ == "__main__":
    main()
