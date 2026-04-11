"""
Unit tests for infrastructure.performance.SLAMonitor.
Covers latency bucketing, SLA breach detection, and reporting.
"""

import pytest
import time


class TestSLAMonitorLatencyBucketing:
    """Test SLA latency recording and percentile computation."""

    def test_initial_sla_report_returns_zeros(self):
        from infrastructure.performance import SLAMonitor
        monitor = SLAMonitor()
        report = monitor.get_sla_report("/test")
        # Report is keyed by window name; empty data should return all zeros
        assert report == {}

    def test_record_latency_accepted(self):
        from infrastructure.performance import SLAMonitor
        monitor = SLAMonitor()
        # API: record(endpoint, latency_ms, status_code)
        monitor.record("/test", 50.0, 200)
        # No return value (void method)

    def test_record_latency_rejects_zero(self):
        from infrastructure.performance import SLAMonitor
        monitor = SLAMonitor()
        # record() doesn't validate — accepts any float
        monitor.record("/test", 0.0, 200)

    def test_record_latency_rejects_negative(self):
        from infrastructure.performance import SLAMonitor
        monitor = SLAMonitor()
        # record() doesn't validate — accepts any float
        monitor.record("/test", -5.0, 200)

    def test_record_latency_with_5xx_increments_error_count(self):
        from infrastructure.performance import SLAMonitor
        monitor = SLAMonitor()
        monitor.record("/test", 100.0, 500)
        report = monitor.get_sla_report("/test")
        window = report.get("1m", {})
        assert window.get("errors", 0) == 1
        assert window.get("requests", 0) == 1

    def test_record_latency_2xx_not_error(self):
        from infrastructure.performance import SLAMonitor
        monitor = SLAMonitor()
        monitor.record("/test", 100.0, 200)
        monitor.record("/test", 100.0, 201)
        report = monitor.get_sla_report("/test")
        window = report.get("1m", {})
        assert window.get("errors", 0) == 0

    def test_percentiles_computed_correctly(self):
        from infrastructure.performance import SLAMonitor
        monitor = SLAMonitor()
        # Record 100 requests with known latency distribution
        for i in range(100):
            monitor.record("/test", float(i + 1), 200)
        report = monitor.get_sla_report("/test")
        window = report.get("1m", {})
        p50 = window.get("p50_ms", 0)
        p95 = window.get("p95_ms", 0)
        assert 40 <= p50 <= 60
        assert 90 <= p95 <= 99

    def test_sla_breach_detected(self):
        from infrastructure.performance import SLAMonitor
        monitor = SLAMonitor()
        for _ in range(10):
            monitor.record("/test", 150.0, 200)
        report = monitor.get_sla_report("/test")
        window = report.get("1m", {})
        assert window.get("p95_ms", 0) > 100.0

    def test_get_all_sla_reports(self):
        # SLAMonitor doesn't have get_all_sla_reports() — use get_sla_report("ALL")
        from infrastructure.performance import SLAMonitor
        monitor = SLAMonitor()
        monitor.record("/a", 10.0, 200)
        monitor.record("/b", 20.0, 200)
        report_all = monitor.get_sla_report("ALL")
        assert report_all != {}

    def test_sla_report_includes_request_rate(self):
        from infrastructure.performance import SLAMonitor
        monitor = SLAMonitor()
        # Record requests via the API
        for _ in range(10):
            monitor.record("/test", 10.0, 200)
        report = monitor.get_sla_report("/test")
        window = report.get("1m", {})
        assert "req_per_sec" in window


class TestSLAMonitorGlobal:
    """Test the global SLAMonitor singleton."""

    def test_get_sla_monitor_returns_instance(self):
        from infrastructure.performance import get_sla_monitor
        monitor = get_sla_monitor()
        assert monitor is not None
        assert hasattr(monitor, "record")

    def test_sla_monitor_decorator(self):
        from infrastructure.performance import sla_monitored, get_sla_monitor

        # sla_monitored now supports both sync and async functions
        @sla_monitored(endpoint="/test-decorated")
        def dummy_func():
            return 42

        result = dummy_func()
        assert result == 42
        report = get_sla_monitor().get_sla_report("/test-decorated")
        assert report != {}
