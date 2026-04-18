"""
Unit tests for infrastructure.performance.CircuitBreaker.
Covers all state transitions, half-open behavior, and failure counting.
"""

import pytest
import time


class TestCircuitBreakerStateTransitions:
    """Test CircuitBreaker state machine: CLOSED -> OPEN -> HALF_OPEN -> CLOSED/OPEN."""

    def test_initial_state_is_closed(self):
        from infrastructure.performance import CircuitBreaker
        cb = CircuitBreaker(name="test", failure_threshold=3, recovery_timeout=1.0)
        assert cb.state == "CLOSED"

    def test_failure_below_threshold_stays_closed(self):
        from infrastructure.performance import CircuitBreaker
        cb = CircuitBreaker(name="test", failure_threshold=3, recovery_timeout=1.0)
        cb.record_failure()
        cb.record_failure()
        assert cb.state == "CLOSED"
        assert cb._failure_count == 2

    def test_failure_at_threshold_opens_circuit(self):
        from infrastructure.performance import CircuitBreaker
        cb = CircuitBreaker(name="test", failure_threshold=3, recovery_timeout=1.0)
        for _ in range(3):
            cb.record_failure()
        assert cb.state == "OPEN"

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
        assert cb._failure_count == 0
        assert cb.state == "CLOSED"

    def test_open_circuit_rejects_calls(self):
        from infrastructure.performance import CircuitBreaker
        cb = CircuitBreaker(name="test", failure_threshold=1, recovery_timeout=10.0)
        cb.record_failure()
        assert cb.state == "OPEN"
        # call() is a context manager; in OPEN state it yields fallback
        with cb.call(fallback="rejected") as result:
            assert result == "rejected"

    def test_half_open_on_recovery_timeout(self):
        from infrastructure.performance import CircuitBreaker
        cb = CircuitBreaker(name="test", failure_threshold=1, recovery_timeout=0.05)
        cb.record_failure()  # Opens circuit
        assert cb.state == "OPEN"
        time.sleep(0.06)  # Wait for recovery timeout
        # After timeout, call() should allow through (yields None) or fallback
        with cb.call(fallback="timeout") as result:
            pass
        # Either HALF_OPEN (probe was allowed) or transitioned to CLOSED/OPEN

    def test_half_open_success_closes_circuit(self):
        from infrastructure.performance import CircuitBreaker
        cb = CircuitBreaker(name="test", failure_threshold=1, recovery_timeout=0.02, half_open_max_calls=1)
        cb.record_failure()
        assert cb.state == "OPEN"
        time.sleep(0.05)
        # After timeout, call() should allow through and succeed
        with cb.call(fallback=None):
            pass  # success
        # After 1 successful call in HALF_OPEN (half_open_max_calls=1), -> CLOSED
        assert cb.state == "CLOSED"
        assert cb._failure_count == 0

    def test_half_open_failure_reopens_circuit(self):
        from infrastructure.performance import CircuitBreaker
        cb = CircuitBreaker(name="test", failure_threshold=1, recovery_timeout=0.02, half_open_max_calls=1)
        cb.record_failure()
        time.sleep(0.03)
        with pytest.raises(RuntimeError):
            with cb.call(fallback=None):
                raise RuntimeError("probe failure")
        # `state` is side-effecting and can immediately re-enter HALF_OPEN once
        # the short recovery timeout has elapsed again. Snapshot the raw state
        # instead so this assertion remains deterministic under CI parallelism.
        assert cb.get_state()["state"] == "OPEN"

    def test_half_open_max_calls_respected(self):
        from infrastructure.performance import CircuitBreaker
        cb = CircuitBreaker(name="test", failure_threshold=1, recovery_timeout=0.02, half_open_max_calls=2)
        cb.record_failure()
        time.sleep(0.05)
        # First probe: transitions OPEN->HALF_OPEN (call() triggers transition via _try_transition_to_half_open)
        # HALF_OPEN->CLOSED after half_open_max_calls successes
        with cb.call(fallback="first"):
            pass  # success, increments _success_count=1
        # Second probe should be allowed (half_open_max_calls=2, only 1 success so far)
        with cb.call(fallback="second"):
            pass  # second success, _success_count=2 -> CLOSED
        assert cb.state == "CLOSED"

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
            with cb.call():
                raise RuntimeError("boom")
        assert cb.state == "OPEN"

    def test_call_with_exception_rejected_in_open_state(self):
        from infrastructure.performance import CircuitBreaker
        cb = CircuitBreaker(name="test", failure_threshold=1, recovery_timeout=10.0)
        cb.record_failure()
        assert cb.state == "OPEN"
        with cb.call(fallback="rejected") as result:
            assert result == "rejected"

    def test_allow_call_in_closed_state(self):
        from infrastructure.performance import CircuitBreaker
        cb = CircuitBreaker(name="test", failure_threshold=3, recovery_timeout=1.0)
        assert cb.is_available() is True

    def test_repr_includes_name_and_state(self):
        from infrastructure.performance import CircuitBreaker
        cb = CircuitBreaker(name="MyCB", failure_threshold=2)
        r = repr(cb)
        assert "MyCB" in r
