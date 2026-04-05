"""
Unit tests for infrastructure.performance.SLAMonitor.
Covers latency bucketing, SLA breach detection, and reporting.
"""

import pytest
import time
import sys
from pathlib import Path

ML_ENGINE = Path(__file__).parent.parent.parent
sys.path.insert(0, str(ML_ENGINE))


class TestSLAMonitorLatencyBucketing:
    """Test SLA latency recording and percentile computation."""

    def test_initial_sla_report_returns_zeros(self):
        from infrastructure.performance import SLAMonitor
        monitor = SLAMonitor()
        report = monitor.get_sla_report("/test")
        assert report["p50_ms"] == 0.0
        assert report["p95_ms"] == 0.0
        assert report["p99_ms"] == 0.0
        assert report["error_rate"] == 0.0

    def test_record_latency_accepted(self):
        from infrastructure.performance import SLAMonitor
        monitor = SLAMonitor()
        accepted = monitor.record_latency("/test", duration_ms=50.0, status=200)
        assert accepted is True

    def test_record_latency_rejects_zero(self):
        from infrastructure.performance import SLAMonitor
        monitor = SLAMonitor()
        accepted = monitor.record_latency("/test", duration_ms=0.0, status=200)
        assert accepted is False

    def test_record_latency_rejects_negative(self):
        from infrastructure.performance import SLAMonitor
        monitor = SLAMonitor()
        accepted = monitor.record_latency("/test", duration_ms=-5.0, status=200)
        assert accepted is False

    def test_record_latency_with_5xx_increments_error_count(self):
        from infrastructure.performance import SLAMonitor
        monitor = SLAMonitor()
        monitor.record_latency("/test", duration_ms=100.0, status=500)
        report = monitor.get_sla_report("/test")
        assert report["error_count"] == 1
        assert report["total_requests"] == 1

    def test_record_latency_2xx_not_error(self):
        from infrastructure.performance import SLAMonitor
        monitor = SLAMonitor()
        monitor.record_latency("/test", duration_ms=100.0, status=200)
        monitor.record_latency("/test", duration_ms=100.0, status=201)
        report = monitor.get_sla_report("/test")
        assert report["error_count"] == 0

    def test_percentiles_computed_correctly(self):
        from infrastructure.performance import SLAMonitor
        monitor = SLAMonitor()
        # Record 100 requests with known latency distribution
        for i in range(100):
            monitor.record_latency("/test", duration_ms=float(i + 1), status=200)
        report = monitor.get_sla_report("/test")
        # p50 should be ~50.5, p95 ~95.5
        assert 40 <= report["p50_ms"] <= 60
        assert 90 <= report["p95_ms"] <= 99

    def test_sla_breach_detected(self):
        from infrastructure.performance import SLAMonitor
        monitor = SLAMonitor(target_p95_ms=100.0)
        for _ in range(10):
            monitor.record_latency("/test", duration_ms=150.0, status=200)
        report = monitor.get_sla_report("/test")
        assert report["p95_ms"] > 100.0

    def test_get_all_sla_reports(self):
        from infrastructure.performance import SLAMonitor
        monitor = SLAMonitor()
        monitor.record_latency("/a", duration_ms=10.0, status=200)
        monitor.record_latency("/b", duration_ms=20.0, status=200)
        reports = monitor.get_all_sla_reports()
        assert "/a" in reports
        assert "/b" in reports
        assert "ALL" in reports

    def test_sla_report_includes_request_rate(self):
        from infrastructure.performance import SLAMonitor
        monitor = SLAMonitor()
        now = time.time()
        monitor._requests["/test"] = []
        for i in range(10):
            monitor._requests["/test"].append((now - i, True))
        report = monitor.get_sla_report("/test")
        assert "requests_per_second" in report


class TestSLAMonitorGlobal:
    """Test the global SLAMonitor singleton."""

    def test_get_sla_monitor_returns_instance(self):
        from infrastructure.performance import get_sla_monitor
        monitor = get_sla_monitor()
        assert monitor is not None
        assert hasattr(monitor, "record_latency")

    def test_sla_monitor_decorator(self):
        from infrastructure.performance import sla_monitored
        from infrastructure.performance import get_sla_monitor

        @sla_monitored(endpoint="/test-decorated")
        def dummy_func():
            return 42

        result = dummy_func()
        assert result == 42
        report = get_sla_monitor().get_sla_report("/test-decorated")
        assert report["total_requests"] >= 1
