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

try:
    import smbus2
    from smbus2 import i2c_msg
    import os
    HARDWARE_AVAILABLE = os.path.exists("/dev/i2c-1")
    if not HARDWARE_AVAILABLE:
        print("[PULSOXIMETRU] I2C /dev/i2c-1 indisponibil - mod simulare activat")
except ImportError:
    HARDWARE_AVAILABLE = False
    print("[PULSOXIMETRU] Biblioteci hardware indisponibile - mod simulare activat")

from sensor_client import SensorClient
import config as sensor_config

INTERVALS = getattr(sensor_config, "INTERVALS", {"pulsoximetru": 1.0})
ADS1115 = getattr(sensor_config, "ADS1115", {})


class PulsOximeter:
    """Citire puls prin senzor analogic + ADS1115."""

    def __init__(self):
        self.client = SensorClient("pulsoximetru")
        self.running = False
        self.hardware_available = HARDWARE_AVAILABLE

        self.channel = ADS1115.get("pulse_channel", 0)
        self.i2c_bus = ADS1115.get("bus", 1)
        self.address = ADS1115.get("address", 0x48)
        self.pga = str(ADS1115.get("pga", "1.024"))
        self.data_rate = int(ADS1115.get("data_rate", 475))
        self.sample_rate_hz = int(ADS1115.get("pulse_sample_rate_hz", 75))
        self.sample_period = 1.0 / self.sample_rate_hz
        self.conversion_delay = max(0.0035, 1.25 / max(8, self.data_rate))

        self.samples = []
        self.max_samples = self.sample_rate_hz * 14
        self.last_sent = 0
        self.min_signal_span = 10
        self.max_signal_span = 1800
        self.bpm_history = []
        self.smoothed_bpm = None
        self.max_bpm_rise_step = 4.5
        self.max_bpm_fall_step = 7.0
        self.min_bpm = 42.0
        self.max_bpm = 135.0
        self.min_peak_distance = 0.42
        self.finger_latch_until = 0.0
        self.finger_release_delay = 2.5
        self.motion_freeze_until = 0.0
        self.motion_hold_seconds = 0.7

        if self.hardware_available:
            try:
                self.bus = smbus2.SMBus(self.i2c_bus)
                self.address = self._probe_ads1115(self.address)
                print(
                    f"[PULSOXIMETRU] ADS1115 detectat pe I2C-{self.i2c_bus} "
                    f"addr 0x{self.address:02X}, canal A{self.channel}, "
                    f"PGA={self.pga}V, DR={self.data_rate}SPS"
                )
            except Exception as e:
                self.hardware_available = False
                print(f"[PULSOXIMETRU] Eroare inițializare ADS1115: {e}. Mod simulare activat.")

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

        moving = (
            baseline_drift > max(180.0, metrics["span"] * 0.8) or
            diff_p90 > max(120.0, pulsatile_energy * 9.0, metrics["span"] * 0.32)
        )

        return {
            "moving": moving,
            "baseline_drift": baseline_drift,
            "diff_p90": diff_p90,
            "pulsatile_energy": pulsatile_energy,
        }

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

        mean_interval = statistics.fmean(intervals)
        if mean_interval <= 0:
            return None

        variability = 0.0
        if len(intervals) >= 3:
            variability = statistics.pstdev(intervals) / mean_interval

        return intervals, mean_interval, variability

    def _estimate_bpm(self):
        """Estimare BPM cu filtrare adaptivă pentru semnale analogice zgomotoase."""
        min_samples = self.sample_rate_hz * 4
        if len(self.samples) < min_samples:
            return None

        window = self.samples[-self.sample_rate_hz * 10:]
        timestamps = [timestamp for timestamp, _ in window]
        values = [value for _, value in window]
        metrics = self._signal_metrics(values)
        if metrics["span"] < self.min_signal_span:
            return None

        stability = self._signal_stability(values[-self.sample_rate_hz * 2:])
        now = timestamps[-1]
        if stability["moving"]:
            self.motion_freeze_until = now + self.motion_hold_seconds
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
        noise_floor = max(1.0, statistics.median(envelope))
        peak_threshold = max(noise_floor * 1.55, metrics["span"] * 0.04)
        prominence_threshold = max(noise_floor * 0.75, metrics["span"] * 0.02)
        search_radius = max(3, int(self.sample_rate_hz * 0.16))
        min_interval = max(self.min_peak_distance, 60.0 / self.max_bpm)
        max_interval = 60.0 / self.min_bpm

        peak_candidates = []

        for index in range(1, len(bandpassed) - 1):
            current_value = bandpassed[index]
            if current_value <= peak_threshold:
                continue
            if current_value < bandpassed[index - 1] or current_value < bandpassed[index + 1]:
                continue

            left = max(0, index - search_radius)
            right = min(len(bandpassed), index + search_radius + 1)
            local_min = min(bandpassed[left:right])
            prominence = current_value - local_min
            if prominence < prominence_threshold:
                continue

            peak_candidates.append((timestamps[index], current_value, prominence))

        if len(peak_candidates) < 3:
            return None

        peak_times = []
        peak_strengths = []

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

        if variability > 0.18:
            return None

        bpm = max(self.min_bpm, min(self.max_bpm, bpm))

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

        return round(bpm, 1)

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
        has_reasonable_span = metrics["span"] >= 4
        has_pulse_energy = pulsatile_energy >= 0.8
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
        """Pornește citirea pulsoximetrului."""
        self.running = True
        self.client.connect_to_server()

        print("[PULSOXIMETRU] Citire pornită. CTRL+C pentru oprire.")

        while self.running:
            loop_start = time.time()
            try:
                if self.hardware_available:
                    raw_value = self._read_adc(self.channel)
                    self.samples.append((loop_start, raw_value))
                    if len(self.samples) > self.max_samples:
                        self.samples = self.samples[-self.max_samples:]

                    if self._finger_present():
                        bpm = self._estimate_bpm()
                    else:
                        bpm = None
                        self.bpm_history = []
                        self.smoothed_bpm = None
                        self.finger_latch_until = 0.0
                        # Păstrează fereastra minimă necesară pentru a putea reintra rapid
                        # în starea "deget prezent" când semnalul revine.
                        keep = self.sample_rate_hz * 3
                        self.samples = self.samples[-keep:]
                else:
                    bpm, raw_value = self._simulate_reading()

                if (loop_start - self.last_sent) >= INTERVALS["pulsoximetru"]:
                    self.last_sent = loop_start
                    recent = [v for _, v in self.samples[-self.sample_rate_hz:]] if self.samples else [raw_value]
                    metrics = self._signal_metrics(recent)
                    stability = self._signal_stability(recent)
                    diagnostic_note = self._diagnose_recent_signal(recent)
                    span = round(metrics["span"])
                    clipped_high = metrics["clipped_high"]
                    clipped_low = metrics["clipped_low"]
                    quality_ok = (
                        self.min_signal_span <= span <= self.max_signal_span and
                        clipped_high <= len(recent) * 0.65 and
                        clipped_low <= len(recent) * 0.65
                    )
                    quality_note = ""
                    if clipped_high > len(recent) * 0.6:
                        quality_note = " | ATENȚIE: semnal saturat sus (verifică V+/S/A0)"
                    elif clipped_low > len(recent) * 0.6:
                        quality_note = " | ATENȚIE: semnal saturat jos (verifică GND/S/A0)"
                    elif stability["moving"]:
                        quality_note = " | artefact de miscare (tine degetul si firele complet nemiscate)"
                    elif span < self.min_signal_span:
                        quality_note = " | semnal prea slab (apasă mai ferm, acoperă LED-ul și ține degetul nemișcat)"

                    if diagnostic_note and diagnostic_note not in quality_note:
                        quality_note = f"{quality_note}{diagnostic_note}"

                    if not quality_ok:
                        bpm = None
                        self.bpm_history = []
                        self.smoothed_bpm = None

                    if stability["moving"]:
                        bpm = None

                    if bpm is not None:
                        self.client.send_reading(
                            value_1=bpm,
                            value_2=None,
                            pacient_id=pacient_id,
                        )
                        print(f"[PULSOXIMETRU] HR: {bpm:.1f} BPM | RAW: {raw_value} | SPAN: {span}{quality_note}")
                    else:
                        print(f"[PULSOXIMETRU] RAW: {raw_value} | SPAN: {span} | BPM: -- (semnal slab/fără deget){quality_note}")

                elapsed = time.time() - loop_start
                sleep_time = self.sample_period - elapsed
                if sleep_time > 0:
                    time.sleep(sleep_time)

            except KeyboardInterrupt:
                break
            except Exception as e:
                print(f"[PULSOXIMETRU] Eroare: {e}")
                time.sleep(0.5)

        self.stop()

    def stop(self):
        """Oprește citirea."""
        self.running = False
        if self.hardware_available:
            self.bus.close()
        self.client.disconnect_from_server()
        print("[PULSOXIMETRU] Oprit.")


def main():
    import argparse
    parser = argparse.ArgumentParser(description="Citire puls analogic via ADS1115")
    parser.add_argument("--pacient", type=int, help="ID-ul pacientului monitorizat")
    args = parser.parse_args()

    sensor = PulsOximeter()

    def signal_handler(sig, frame):
        sensor.stop()
        sys.exit(0)

    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)

    sensor.start(pacient_id=args.pacient)


if __name__ == "__main__":
    main()
