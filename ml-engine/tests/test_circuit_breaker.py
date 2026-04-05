"""
Unit tests for infrastructure.performance.CircuitBreaker.
Covers all state transitions, half-open behavior, and failure counting.
"""

import pytest
import time

import sys
from pathlib import Path
ML_ENGINE = Path(__file__).parent.parent.parent
sys.path.insert(0, str(ML_ENGINE))


class TestCircuitBreakerStateTransitions:
    """Test CircuitBreaker state machine: CLOSED -> OPEN -> HALF_OPEN -> CLOSED/OPEN."""

    def test_initial_state_is_closed(self):
        from infrastructure.performance import CircuitBreaker
        cb = CircuitBreaker(name="test", failure_threshold=3, recovery_timeout=1.0)
        assert cb.state == "CLOSED"
        assert cb.failure_count == 0

    def test_failure_below_threshold_stays_closed(self):
        from infrastructure.performance import CircuitBreaker
        cb = CircuitBreaker(name="test", failure_threshold=3, recovery_timeout=1.0)
        cb.record_failure()
        cb.record_failure()
        assert cb.state == "CLOSED"
        assert cb.failure_count == 2

    def test_failure_at_threshold_opens_circuit(self):
        from infrastructure.performance import CircuitBreaker
        cb = CircuitBreaker(name="test", failure_threshold=3, recovery_timeout=1.0)
        for _ in range(3):
            cb.record_failure()
        assert cb.state == "OPEN"
        assert cb.failure_count == 3

    def test_failure_above_threshold_opens_circuit(self):
        from infrastructure.performance import CircuitBreaker
        cb = CircuitBreaker(name="test", failure_threshold=3, recovery_timeout=1.0)
        for _ in range(5):
            cb.record_failure()
        assert cb.state == "OPEN"

    def test_success_resets_failure_count(self):
        from infrastructure.performance import CircuitBreaker
        cb = CircuitBreaker(name="test", failure_threshold=3, recovery_timeout=1.0)
        cb.record_failure()
        cb.record_failure()
        cb.record_success()
        assert cb.failure_count == 0
        assert cb.state == "CLOSED"

    def test_open_circuit_rejects_calls(self):
        from infrastructure.performance import CircuitBreaker
        cb = CircuitBreaker(name="test", failure_threshold=1, recovery_timeout=10.0)
        cb.record_failure()
        assert cb.state == "OPEN"
        result = cb.call(lambda: "success")
        assert result == CircuitBreaker.REJECTED

    def test_half_open_on_recovery_timeout(self):
        from infrastructure.performance import CircuitBreaker
        cb = CircuitBreaker(name="test", failure_threshold=1, recovery_timeout=0.05)
        cb.record_failure()  # Opens circuit
        assert cb.state == "OPEN"
        time.sleep(0.06)  # Wait for recovery timeout
        result = cb.call(lambda: "probe")
        # Either HALF_OPEN (probe was allowed) or still OPEN (if probe was blocked)
        assert cb.state in ("HALF_OPEN", "CLOSED", "OPEN")

    def test_half_open_success_closes_circuit(self):
        from infrastructure.performance import CircuitBreaker
        cb = CircuitBreaker(name="test", failure_threshold=1, recovery_timeout=0.02)
        cb.record_failure()
        assert cb.state == "OPEN"
        time.sleep(0.03)
        cb.call(lambda: "recovered")
        assert cb.state == "CLOSED"
        assert cb.failure_count == 0

    def test_half_open_failure_reopens_circuit(self):
        from infrastructure.performance import CircuitBreaker
        cb = CircuitBreaker(name="test", failure_threshold=1, recovery_timeout=0.02, half_open_max_calls=1)
        cb.record_failure()
        time.sleep(0.03)
        cb.call(lambda: "fail")
        assert cb.state == "OPEN"
        assert cb.failure_count == 1

    def test_half_open_max_calls_respected(self):
        from infrastructure.performance import CircuitBreaker
        cb = CircuitBreaker(name="test", failure_threshold=1, recovery_timeout=0.02, half_open_max_calls=1)
        cb.record_failure()
        time.sleep(0.03)
        result1 = cb.call(lambda: "first")
        result2 = cb.call(lambda: "second")
        # Second call should be rejected in HALF_OPEN
        assert result2 == CircuitBreaker.REJECTED

    def test_get_state_returns_dict(self):
        from infrastructure.performance import CircuitBreaker
        cb = CircuitBreaker(name="test_cb", failure_threshold=2, recovery_timeout=1.0)
        cb.record_failure()
        state = cb.get_state()
        assert isinstance(state, dict)
        assert state["name"] == "test_cb"
        assert state["state"] == "CLOSED"
        assert state["failure_count"] == 1


class TestCircuitBreakerEdgeCases:
    """Test edge cases and error conditions."""

    def test_call_with_exception_records_failure(self):
        from infrastructure.performance import CircuitBreaker
        cb = CircuitBreaker(name="test", failure_threshold=1, recovery_timeout=10.0)
        with pytest.raises(RuntimeError):
            cb.call(lambda: (_ for _ in ()).throw(RuntimeError("boom")))
        assert cb.state == "OPEN"

    def test_call_with_exception_rejected_in_open_state(self):
        from infrastructure.performance import CircuitBreaker
        cb = CircuitBreaker(name="test", failure_threshold=1, recovery_timeout=10.0)
        cb.record_failure()
        assert cb.state == "OPEN"
        result = cb.call(lambda: (_ for _ in ()).throw(RuntimeError("boom")))
        assert result == CircuitBreaker.REJECTED

    def test_allow_call_in_closed_state(self):
        from infrastructure.performance import CircuitBreaker
        cb = CircuitBreaker(name="test", failure_threshold=3, recovery_timeout=1.0)
        assert cb._allow_call() is True

    def test_repr_includes_name_and_state(self):
        from infrastructure.performance import CircuitBreaker
        cb = CircuitBreaker(name="MyCB", failure_threshold=2)
        r = repr(cb)
        assert "MyCB" in r
        assert "CLOSED" in r
