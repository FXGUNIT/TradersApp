"""
Basic event-driven backtesting rig for NSE session-aware research.

The goal here is scaffolding, not a full execution simulator. The rig:
  - normalizes OHLCV input into an NSE-aware event stream
  - supports a simple single-position futures-like PnL model
  - accepts callback strategies or a small kernc/backtesting.py-style class API
  - avoids a hard dependency on the external ``backtesting`` package

This keeps ML8 moving without coupling to the current training/inference stack.
"""

from __future__ import annotations

from collections.abc import Callable, Iterable, Sequence
from dataclasses import asdict, dataclass, field
from datetime import datetime
from importlib import metadata
from typing import Any, Literal, Protocol

import pandas as pd

try:
    from infrastructure.session_loader import SessionLoader
    from infrastructure.timezone_utils import TZ_KOLKATA
except ModuleNotFoundError:  # pragma: no cover - fallback for package-style imports
    from ml_engine.infrastructure.session_loader import SessionLoader
    from ml_engine.infrastructure.timezone_utils import TZ_KOLKATA

SignalAction = Literal["buy", "sell", "close", "hold"]
PositionSide = Literal["long", "short"]
SessionName = Literal["pre_market", "main_trading", "post_market", "closed"]

_COLUMN_ALIASES: dict[str, tuple[str, ...]] = {
    "timestamp": ("timestamp", "datetime", "date", "time"),
    "open": ("open", "Open"),
    "high": ("high", "High"),
    "low": ("low", "Low"),
    "close": ("close", "Close"),
    "volume": ("volume", "Volume"),
    "symbol": ("symbol", "Symbol"),
}
_SESSION_NORMALIZATION = {
    "regular": "main_trading",
}
_DEFAULT_TRADEABLE_SESSIONS: tuple[SessionName, ...] = ("main_trading",)


def detect_kernc_backtesting_version() -> str | None:
    """
    Return the installed `backtesting` distribution version if present.

    The rig does not import it directly because this repo's package layout can
    shadow the external module name. The version check is still useful for
    reporting whether parity work can be attempted later.
    """
    try:
        return metadata.version("backtesting")
    except metadata.PackageNotFoundError:
        return None


class BacktestInputError(ValueError):
    """Raised when the source frame is missing required structure."""


@dataclass(frozen=True)
class MarketBar:
    """Single normalized market event produced by the rig."""

    timestamp: datetime
    open: float
    high: float
    low: float
    close: float
    volume: float
    session: SessionName
    symbol: str | None = None
    row_number: int = 0
    tradeable: bool = False
    extra: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class OrderRequest:
    """Strategy intent before execution."""

    action: SignalAction
    size: float = 1.0
    tag: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class FillEvent:
    """Executed order event."""

    timestamp: datetime
    action: SignalAction
    price: float
    size: float
    commission: float
    slippage_bps: float
    tag: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class PositionState:
    """Current open position state."""

    side: PositionSide
    size: float
    entry_time: datetime
    entry_price: float
    entry_commission: float
    entry_session: SessionName
    entry_bar: int
    tag: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)

    @property
    def signed_size(self) -> float:
        return self.size if self.side == "long" else -self.size

    def unrealized_pnl(self, mark_price: float) -> float:
        direction = 1.0 if self.side == "long" else -1.0
        return (mark_price - self.entry_price) * direction * self.size


@dataclass(frozen=True)
class TradeRecord:
    """Closed trade ledger entry."""

    symbol: str | None
    side: PositionSide
    entry_time: datetime
    exit_time: datetime
    entry_price: float
    exit_price: float
    size: float
    pnl: float
    return_pct: float
    entry_session: SessionName
    exit_session: SessionName
    entry_bar: int
    exit_bar: int
    entry_tag: str | None = None
    exit_tag: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class BacktestMetrics:
    """High-level summary metrics for a completed run."""

    total_return_pct: float
    max_drawdown_pct: float
    win_rate: float
    profit_factor: float | None
    closed_trades: int
    winners: int
    losers: int
    exposure_bars: int


@dataclass(frozen=True)
class BacktestResult:
    """Full result payload for one backtest run."""

    symbol: str | None
    initial_cash: float
    final_cash: float
    final_equity: float
    metrics: BacktestMetrics
    trades: list[TradeRecord]
    fills: list[FillEvent]
    equity_curve: pd.DataFrame
    session_counts: dict[str, int]
    metadata: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        """Serialize the result into JSON-friendly primitives."""
        return {
            "symbol": self.symbol,
            "initial_cash": self.initial_cash,
            "final_cash": self.final_cash,
            "final_equity": self.final_equity,
            "metrics": asdict(self.metrics),
            "trades": [asdict(trade) for trade in self.trades],
            "fills": [asdict(fill) for fill in self.fills],
            "equity_curve": self.equity_curve.to_dict(orient="records"),
            "session_counts": self.session_counts,
            "metadata": self.metadata,
        }


class StrategyCallback(Protocol):
    """Protocol for plain callback strategies."""

    def __call__(
        self,
        bar: MarketBar,
        context: "StrategyContext",
    ) -> OrderRequest | Sequence[OrderRequest] | None:
        ...


class _DataWindow:
    """Rolling data view for strategy classes."""

    def __init__(self) -> None:
        self._frame = pd.DataFrame()

    def bind(self, frame: pd.DataFrame) -> None:
        self._frame = frame

    def __len__(self) -> int:
        return len(self._frame)

    @property
    def df(self) -> pd.DataFrame:
        return self._frame.copy()

    @property
    def index(self) -> pd.Index:
        return self._frame.index

    @property
    def Open(self) -> pd.Series:
        return self._frame["open"]

    @property
    def High(self) -> pd.Series:
        return self._frame["high"]

    @property
    def Low(self) -> pd.Series:
        return self._frame["low"]

    @property
    def Close(self) -> pd.Series:
        return self._frame["close"]

    @property
    def Volume(self) -> pd.Series:
        return self._frame["volume"]


class _PositionProxy:
    """Minimal kernc-style position proxy for strategy classes."""

    def __init__(self, context: "StrategyContext") -> None:
        self._context = context

    @property
    def size(self) -> float:
        return 0.0 if self._context.position is None else self._context.position.size

    @property
    def is_long(self) -> bool:
        return self._context.position is not None and self._context.position.side == "long"

    @property
    def is_short(self) -> bool:
        return self._context.position is not None and self._context.position.side == "short"

    @property
    def pl(self) -> float:
        if self._context.position is None or self._context.current_bar is None:
            return 0.0
        return self._context.position.unrealized_pnl(self._context.current_bar.close)

    def close(self, *, tag: str | None = None, **metadata: Any) -> None:
        self._context.close_position(tag=tag, **metadata)


class StrategyContext:
    """
    Mutable per-run strategy context.

    The context intentionally exposes explicit order methods rather than a full
    broker abstraction. That keeps the rig simple while still supporting both a
    callback API and a backtesting.py-style class API.
    """

    def __init__(self, rig: "EventDrivenBacktestRig") -> None:
        self._rig = rig
        self._pending_orders: list[OrderRequest] = []
        self.current_bar: MarketBar | None = None
        self.position: PositionState | None = None
        self.cash: float = rig.initial_cash
        self.equity: float = rig.initial_cash
        self.data = _DataWindow()
        self.position_view = _PositionProxy(self)

    @property
    def calendar(self) -> SessionLoader:
        return self._rig.session_loader

    @property
    def history(self) -> pd.DataFrame:
        return self.data.df

    def sync(
        self,
        *,
        bar: MarketBar,
        history: pd.DataFrame,
        position: PositionState | None,
        cash: float,
        equity: float,
    ) -> None:
        self.current_bar = bar
        self.position = position
        self.cash = cash
        self.equity = equity
        self.data.bind(history)

    def buy(self, *, size: float = 1.0, tag: str | None = None, **metadata: Any) -> None:
        self._pending_orders.append(OrderRequest(action="buy", size=size, tag=tag, metadata=metadata))

    def sell(self, *, size: float = 1.0, tag: str | None = None, **metadata: Any) -> None:
        self._pending_orders.append(OrderRequest(action="sell", size=size, tag=tag, metadata=metadata))

    def close_position(self, *, tag: str | None = None, **metadata: Any) -> None:
        self._pending_orders.append(OrderRequest(action="close", tag=tag, metadata=metadata))

    def drain_orders(self) -> list[OrderRequest]:
        orders = list(self._pending_orders)
        self._pending_orders.clear()
        return orders


class KerncStyleStrategy:
    """
    Lightweight strategy base with a kernc/backtesting.py-like shape.

    Example:
        class BuyAndHold(KerncStyleStrategy):
            def next(self):
                if not self.position.is_long:
                    self.buy(tag="entry")
    """

    def __init__(self, **params: Any) -> None:
        for name, value in params.items():
            setattr(self, name, value)
        self.data = _DataWindow()
        self.position: _PositionProxy | None = None
        self._context: StrategyContext | None = None

    def bind(self, context: StrategyContext) -> None:
        self._context = context
        self.data = context.data
        self.position = context.position_view

    def init(self) -> None:
        """Optional one-time setup hook."""

    def next(self) -> OrderRequest | Sequence[OrderRequest] | None:
        """Per-bar hook."""
        return None

    def buy(self, *, size: float = 1.0, tag: str | None = None, **metadata: Any) -> None:
        if self._context is None:
            raise RuntimeError("Strategy is not bound to a context")
        self._context.buy(size=size, tag=tag, **metadata)

    def sell(self, *, size: float = 1.0, tag: str | None = None, **metadata: Any) -> None:
        if self._context is None:
            raise RuntimeError("Strategy is not bound to a context")
        self._context.sell(size=size, tag=tag, **metadata)

    def close(self, *, tag: str | None = None, **metadata: Any) -> None:
        if self._context is None:
            raise RuntimeError("Strategy is not bound to a context")
        self._context.close_position(tag=tag, **metadata)


@dataclass
class EventDrivenBacktestRig:
    """
    Event-driven scaffold for session-aware research backtests.

    Extension points:
      - override `prepare_data()` to enrich/reshape bars
      - override `_execute_signal()` for a richer execution model
      - override `_build_result_metadata()` to attach model/session diagnostics
    """

    data: pd.DataFrame
    symbol: str | None = None
    initial_cash: float = 100_000.0
    commission_bps: float = 0.0
    slippage_bps: float = 0.0
    tradeable_sessions: tuple[SessionName, ...] = _DEFAULT_TRADEABLE_SESSIONS
    close_positions_at_session_end: bool = True
    allow_short: bool = True
    session_loader: SessionLoader = field(default_factory=SessionLoader)

    def __post_init__(self) -> None:
        self._prepared_data = self.prepare_data(self.data)

    @classmethod
    def from_dataframe(cls, data: pd.DataFrame, **kwargs: Any) -> "EventDrivenBacktestRig":
        """Named constructor for clearer call sites."""
        return cls(data=data, **kwargs)

    def prepare_data(self, data: pd.DataFrame) -> pd.DataFrame:
        """Normalize the incoming frame into the rig's canonical schema."""
        frame = data.copy()
        if frame.empty:
            raise BacktestInputError("Backtest data frame is empty")

        resolved = {name: self._resolve_column(frame.columns, name) for name in _COLUMN_ALIASES}
        if resolved["timestamp"] is None:
            if isinstance(frame.index, pd.DatetimeIndex):
                frame = frame.reset_index().rename(columns={frame.index.name or "index": "timestamp"})
                resolved["timestamp"] = "timestamp"
            else:
                raise BacktestInputError("Expected a timestamp column or DatetimeIndex")

        missing = [name for name in ("open", "high", "low", "close", "volume") if resolved[name] is None]
        if missing:
            raise BacktestInputError(f"Missing required OHLCV columns: {', '.join(missing)}")

        normalized = pd.DataFrame()
        normalized["timestamp"] = self._normalize_timestamp_series(frame[resolved["timestamp"]])
        for canonical in ("open", "high", "low", "close", "volume"):
            source = resolved[canonical]
            normalized[canonical] = pd.to_numeric(frame[source], errors="coerce")
        normalized["symbol"] = (
            frame[resolved["symbol"]].astype(str)
            if resolved["symbol"] is not None
            else self.symbol
        )

        numeric_cols = ["open", "high", "low", "close", "volume"]
        if normalized[numeric_cols].isnull().any().any():
            raise BacktestInputError("OHLCV columns contain null or non-numeric values")

        normalized = normalized.sort_values("timestamp").drop_duplicates(subset="timestamp").reset_index(drop=True)
        normalized["session"] = normalized["timestamp"].map(self._session_for_timestamp)
        normalized["tradeable"] = normalized["session"].isin(self.tradeable_sessions)
        normalized["trade_date"] = normalized["timestamp"].dt.date
        normalized = normalized.set_index("timestamp", drop=False)
        return normalized

    def to_backtesting_frame(self) -> pd.DataFrame:
        """
        Return a frame compatible with common backtesting.py conventions.

        The external package is optional. This method only shapes the data.
        """
        frame = self._prepared_data[["open", "high", "low", "close", "volume"]].copy()
        return frame.rename(
            columns={
                "open": "Open",
                "high": "High",
                "low": "Low",
                "close": "Close",
                "volume": "Volume",
            }
        )

    def run(
        self,
        strategy: KerncStyleStrategy | StrategyCallback | Callable[..., Any] | type[KerncStyleStrategy],
        **strategy_kwargs: Any,
    ) -> BacktestResult:
        """Execute the event loop and return the completed backtest result."""
        runtime = _StrategyRuntime(strategy=strategy, context=StrategyContext(self), strategy_kwargs=strategy_kwargs)
        runtime.initialize()

        cash = float(self.initial_cash)
        position: PositionState | None = None
        fills: list[FillEvent] = []
        trades: list[TradeRecord] = []
        equity_rows: list[dict[str, Any]] = []
        exposure_bars = 0

        for row_number in range(len(self._prepared_data)):
            history = self._prepared_data.iloc[: row_number + 1]
            row = self._prepared_data.iloc[row_number]
            bar = self._row_to_bar(row_number=row_number, row=row)
            equity_before = cash if position is None else cash + position.unrealized_pnl(bar.close)
            runtime.context.sync(
                bar=bar,
                history=history,
                position=position,
                cash=cash,
                equity=equity_before,
            )

            if bar.tradeable:
                for signal in runtime.generate_signals(bar):
                    position, cash, trade = self._execute_signal(
                        signal=signal,
                        bar=bar,
                        position=position,
                        cash=cash,
                        symbol=self._resolve_symbol(row),
                    )
                    fills.extend(trade["fills"])
                    trades.extend(trade["trades"])

            if position is not None and self._should_flatten_at_bar_end(row_number):
                position, cash, trade = self._close_position(
                    position=position,
                    bar=bar,
                    cash=cash,
                    symbol=self._resolve_symbol(row),
                    tag="session_end",
                    metadata={"reason": "session_end"},
                )
                fills.extend(trade["fills"])
                trades.extend(trade["trades"])

            if position is not None:
                exposure_bars += 1

            equity_after = cash if position is None else cash + position.unrealized_pnl(bar.close)
            equity_rows.append(
                {
                    "timestamp": bar.timestamp,
                    "equity": equity_after,
                    "cash": cash,
                    "session": bar.session,
                    "tradeable": bar.tradeable,
                    "position_side": None if position is None else position.side,
                }
            )

        if position is not None:
            last_row = self._prepared_data.iloc[-1]
            last_bar = self._row_to_bar(row_number=len(self._prepared_data) - 1, row=last_row)
            position, cash, trade = self._close_position(
                position=position,
                bar=last_bar,
                cash=cash,
                symbol=self._resolve_symbol(last_row),
                tag="end_of_backtest",
                metadata={"reason": "end_of_backtest"},
            )
            fills.extend(trade["fills"])
            trades.extend(trade["trades"])
            equity_rows.append(
                {
                    "timestamp": last_bar.timestamp,
                    "equity": cash,
                    "cash": cash,
                    "session": last_bar.session,
                    "tradeable": last_bar.tradeable,
                    "position_side": None,
                }
            )

        equity_curve = pd.DataFrame(equity_rows)
        metrics = self._compute_metrics(equity_curve=equity_curve, trades=trades, exposure_bars=exposure_bars)
        session_counts = self._prepared_data["session"].value_counts().sort_index().to_dict()
        return BacktestResult(
            symbol=self.symbol or self._resolve_symbol(self._prepared_data.iloc[0]),
            initial_cash=self.initial_cash,
            final_cash=cash,
            final_equity=float(equity_curve["equity"].iloc[-1]) if not equity_curve.empty else cash,
            metrics=metrics,
            trades=trades,
            fills=fills,
            equity_curve=equity_curve,
            session_counts=session_counts,
            metadata=self._build_result_metadata(runtime),
        )

    def _build_result_metadata(self, runtime: "_StrategyRuntime") -> dict[str, Any]:
        return {
            "engine": "event_driven_nse_scaffold",
            "tradeable_sessions": list(self.tradeable_sessions),
            "close_positions_at_session_end": self.close_positions_at_session_end,
            "allow_short": self.allow_short,
            "commission_bps": self.commission_bps,
            "slippage_bps": self.slippage_bps,
            "kernc_backtesting_version": detect_kernc_backtesting_version(),
            "strategy_type": runtime.strategy_type,
        }

    def _compute_metrics(
        self,
        *,
        equity_curve: pd.DataFrame,
        trades: list[TradeRecord],
        exposure_bars: int,
    ) -> BacktestMetrics:
        if equity_curve.empty:
            return BacktestMetrics(0.0, 0.0, 0.0, None, 0, 0, 0, 0)

        equity = equity_curve["equity"].astype(float)
        running_peak = equity.cummax()
        drawdown_pct = ((equity / running_peak) - 1.0) * 100.0
        total_return_pct = ((equity.iloc[-1] / float(self.initial_cash)) - 1.0) * 100.0

        winners = sum(1 for trade in trades if trade.pnl > 0)
        losers = sum(1 for trade in trades if trade.pnl < 0)
        closed_trades = len(trades)
        gross_profit = sum(trade.pnl for trade in trades if trade.pnl > 0)
        gross_loss = abs(sum(trade.pnl for trade in trades if trade.pnl < 0))
        profit_factor = None if gross_loss == 0 else gross_profit / gross_loss
        win_rate = 0.0 if closed_trades == 0 else winners / closed_trades

        return BacktestMetrics(
            total_return_pct=round(total_return_pct, 6),
            max_drawdown_pct=round(abs(drawdown_pct.min()), 6),
            win_rate=round(win_rate, 6),
            profit_factor=None if profit_factor is None else round(profit_factor, 6),
            closed_trades=closed_trades,
            winners=winners,
            losers=losers,
            exposure_bars=exposure_bars,
        )

    def _resolve_column(self, columns: pd.Index, canonical: str) -> str | None:
        aliases = _COLUMN_ALIASES[canonical]
        lookup = {str(column).lower(): str(column) for column in columns}
        for alias in aliases:
            hit = lookup.get(alias.lower())
            if hit is not None:
                return hit
        return None

    def _normalize_timestamp_series(self, values: pd.Series) -> pd.Series:
        timestamps = pd.to_datetime(values, errors="raise")
        if timestamps.dt.tz is None:
            return timestamps.dt.tz_localize(TZ_KOLKATA)
        return timestamps.dt.tz_convert(TZ_KOLKATA)

    def _session_for_timestamp(self, timestamp: pd.Timestamp) -> SessionName:
        session = self.session_loader.get_session_for_time(timestamp.to_pydatetime())
        return _SESSION_NORMALIZATION.get(session, session)  # type: ignore[return-value]

    def _row_to_bar(self, *, row_number: int, row: pd.Series) -> MarketBar:
        extra = {
            key: row[key]
            for key in row.index
            if key not in {"timestamp", "open", "high", "low", "close", "volume", "session", "tradeable", "symbol", "trade_date"}
        }
        symbol = self._resolve_symbol(row)
        return MarketBar(
            timestamp=row["timestamp"].to_pydatetime() if hasattr(row["timestamp"], "to_pydatetime") else row["timestamp"],
            open=float(row["open"]),
            high=float(row["high"]),
            low=float(row["low"]),
            close=float(row["close"]),
            volume=float(row["volume"]),
            session=row["session"],
            symbol=symbol,
            row_number=row_number,
            tradeable=bool(row["tradeable"]),
            extra=extra,
        )

    def _resolve_symbol(self, row: pd.Series) -> str | None:
        if "symbol" not in row or pd.isna(row["symbol"]):
            return self.symbol
        value = row["symbol"]
        return None if value is None else str(value)

    def _should_flatten_at_bar_end(self, row_number: int) -> bool:
        if not self.close_positions_at_session_end:
            return False
        current = self._prepared_data.iloc[row_number]
        if current["session"] not in self.tradeable_sessions:
            return False
        if row_number >= len(self._prepared_data) - 1:
            return True
        next_row = self._prepared_data.iloc[row_number + 1]
        return bool(
            next_row["trade_date"] != current["trade_date"]
            or next_row["session"] != current["session"]
            or not next_row["tradeable"]
        )

    def _execute_signal(
        self,
        *,
        signal: OrderRequest,
        bar: MarketBar,
        position: PositionState | None,
        cash: float,
        symbol: str | None,
    ) -> tuple[PositionState | None, float, dict[str, list[Any]]]:
        fills: list[FillEvent] = []
        trades: list[TradeRecord] = []

        if signal.action == "hold":
            return position, cash, {"fills": fills, "trades": trades}

        if signal.size <= 0:
            raise BacktestInputError(f"Order size must be positive, got {signal.size}")

        if signal.action == "close":
            if position is None:
                return None, cash, {"fills": fills, "trades": trades}
            position, cash, closed = self._close_position(
                position=position,
                bar=bar,
                cash=cash,
                symbol=symbol,
                tag=signal.tag,
                metadata=signal.metadata,
            )
            fills.extend(closed["fills"])
            trades.extend(closed["trades"])
            return position, cash, {"fills": fills, "trades": trades}

        desired_side: PositionSide = "long" if signal.action == "buy" else "short"
        if desired_side == "short" and not self.allow_short:
            if position is not None and position.side == "long":
                position, cash, closed = self._close_position(
                    position=position,
                    bar=bar,
                    cash=cash,
                    symbol=symbol,
                    tag=signal.tag,
                    metadata={"reason": "flatten_only", **signal.metadata},
                )
                fills.extend(closed["fills"])
                trades.extend(closed["trades"])
            return position, cash, {"fills": fills, "trades": trades}

        if position is not None and position.side != desired_side:
            position, cash, closed = self._close_position(
                position=position,
                bar=bar,
                cash=cash,
                symbol=symbol,
                tag=signal.tag,
                metadata={"reason": "reverse", **signal.metadata},
            )
            fills.extend(closed["fills"])
            trades.extend(closed["trades"])

        if position is None:
            fill = self._make_fill(
                action=signal.action,
                bar=bar,
                size=signal.size,
                tag=signal.tag,
                metadata=signal.metadata,
            )
            cash -= fill.commission
            fills.append(fill)
            position = PositionState(
                side=desired_side,
                size=signal.size,
                entry_time=bar.timestamp,
                entry_price=fill.price,
                entry_commission=fill.commission,
                entry_session=bar.session,
                entry_bar=bar.row_number,
                tag=signal.tag,
                metadata=signal.metadata.copy(),
            )

        return position, cash, {"fills": fills, "trades": trades}

    def _close_position(
        self,
        *,
        position: PositionState,
        bar: MarketBar,
        cash: float,
        symbol: str | None,
        tag: str | None,
        metadata: dict[str, Any],
    ) -> tuple[None, float, dict[str, list[Any]]]:
        closing_action: SignalAction = "sell" if position.side == "long" else "buy"
        fill = self._make_fill(
            action=closing_action,
            bar=bar,
            size=position.size,
            tag=tag,
            metadata=metadata,
        )
        pnl = position.unrealized_pnl(fill.price)
        cash += pnl
        cash -= fill.commission
        trade = TradeRecord(
            symbol=symbol,
            side=position.side,
            entry_time=position.entry_time,
            exit_time=bar.timestamp,
            entry_price=position.entry_price,
            exit_price=fill.price,
            size=position.size,
            pnl=round(pnl - position.entry_commission - fill.commission, 6),
            return_pct=round(((fill.price / position.entry_price) - 1.0) * (100.0 if position.side == "long" else -100.0), 6),
            entry_session=position.entry_session,
            exit_session=bar.session,
            entry_bar=position.entry_bar,
            exit_bar=bar.row_number,
            entry_tag=position.tag,
            exit_tag=tag,
            metadata={**position.metadata, **metadata},
        )
        return None, cash, {"fills": [fill], "trades": [trade]}

    def _make_fill(
        self,
        *,
        action: SignalAction,
        bar: MarketBar,
        size: float,
        tag: str | None,
        metadata: dict[str, Any],
    ) -> FillEvent:
        fill_price = self._apply_slippage(price=bar.close, action=action)
        commission = abs(fill_price * size) * (self.commission_bps / 10_000.0)
        return FillEvent(
            timestamp=bar.timestamp,
            action=action,
            price=round(fill_price, 8),
            size=size,
            commission=round(commission, 8),
            slippage_bps=self.slippage_bps,
            tag=tag,
            metadata=metadata.copy(),
        )

    def _apply_slippage(self, *, price: float, action: SignalAction) -> float:
        slippage = self.slippage_bps / 10_000.0
        if action == "buy":
            return price * (1.0 + slippage)
        if action == "sell":
            return price * (1.0 - slippage)
        return price


@dataclass
class _StrategyRuntime:
    strategy: KerncStyleStrategy | StrategyCallback | Callable[..., Any] | type[KerncStyleStrategy]
    context: StrategyContext
    strategy_kwargs: dict[str, Any] = field(default_factory=dict)
    strategy_type: str = field(init=False, default="callback")
    _callable: Callable[[MarketBar, StrategyContext], Any] | None = field(init=False, default=None)
    _klass: KerncStyleStrategy | None = field(init=False, default=None)

    def initialize(self) -> None:
        if isinstance(self.strategy, type) and issubclass(self.strategy, KerncStyleStrategy):
            self.strategy_type = "kernc_style_class"
            self._klass = self.strategy(**self.strategy_kwargs)
        elif isinstance(self.strategy, KerncStyleStrategy):
            self.strategy_type = "kernc_style_instance"
            self._klass = self.strategy
        elif hasattr(self.strategy, "on_bar"):
            self.strategy_type = "strategy_object"
            self._callable = getattr(self.strategy, "on_bar")
        else:
            self.strategy_type = "callback"
            self._callable = self.strategy  # type: ignore[assignment]

        if self._klass is not None:
            self._klass.bind(self.context)
            self._klass.init()

    def generate_signals(self, bar: MarketBar) -> list[OrderRequest]:
        if self._klass is not None:
            returned = self._klass.next()
            pending = self.context.drain_orders()
            return pending + self._normalize_signal_output(returned)

        if self._callable is None:
            return []
        returned = self._callable(bar, self.context)
        pending = self.context.drain_orders()
        return pending + self._normalize_signal_output(returned)

    def _normalize_signal_output(self, returned: Any) -> list[OrderRequest]:
        if returned is None:
            return []
        if isinstance(returned, OrderRequest):
            return [returned]
        if isinstance(returned, Sequence) and not isinstance(returned, (str, bytes)):
            signals = list(returned)
            if not all(isinstance(signal, OrderRequest) for signal in signals):
                raise BacktestInputError("Strategy returned a sequence containing non-OrderRequest values")
            return signals
        raise BacktestInputError("Strategy must return OrderRequest, a sequence of OrderRequest, or None")
