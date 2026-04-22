from datetime import datetime

from infrastructure.session_state_machine import SessionStateMachine
from infrastructure.timezone_utils import TZ_KOLKATA


def test_current_state_inside_pre_market():
    machine = SessionStateMachine()

    snapshot = machine.current_state(datetime(2026, 4, 22, 9, 10, tzinfo=TZ_KOLKATA))

    assert snapshot.session_name == "pre_market"
    assert snapshot.is_open is True
    assert snapshot.opens_at == datetime(2026, 4, 22, 9, 0, tzinfo=TZ_KOLKATA)
    assert snapshot.closes_at == datetime(2026, 4, 22, 9, 15, tzinfo=TZ_KOLKATA)


def test_next_transition_rolls_to_next_trading_day_after_close():
    machine = SessionStateMachine()

    transition = machine.next_transition(datetime(2026, 4, 24, 16, 5, tzinfo=TZ_KOLKATA))

    assert transition.session_name == "pre_market"
    assert transition.transition_type == "open"
    assert transition.transition_at == datetime(2026, 4, 27, 9, 0, tzinfo=TZ_KOLKATA)
