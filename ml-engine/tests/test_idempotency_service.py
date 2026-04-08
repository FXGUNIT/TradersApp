from infrastructure.idempotency import IdempotencyService


class FakePipeline:
    def __init__(self, client):
        self.client = client
        self.ops = []

    def setex(self, key, ttl_seconds, value):
        self.ops.append(("setex", key, value))
        return self

    def delete(self, key):
        self.ops.append(("delete", key))
        return self

    def execute(self):
        for op in self.ops:
            if op[0] == "setex":
                _, key, value = op
                self.client.store[key] = value
            elif op[0] == "delete":
                _, key = op
                self.client.store.pop(key, None)
        self.ops.clear()
        return True


class FakeRedis:
    def __init__(self):
        self.store = {}

    def get(self, key):
        return self.store.get(key)

    def set(self, key, value, nx=False, ex=None):
        if nx and key in self.store:
            return False
        self.store[key] = value
        return True

    def delete(self, key):
        self.store.pop(key, None)
        return 1

    def pipeline(self):
        return FakePipeline(self)


def test_idempotency_replays_completed_response():
    service = IdempotencyService(client=FakeRedis())
    payload = {"symbol": "MNQ", "session_id": 1}

    first_claim = service.claim("predict", "idem-1", payload)
    assert first_claim is not None
    assert first_claim.owner is True
    assert first_claim.replay_response is None

    response_payload = {"ok": True, "signal": "LONG"}
    service.store_response(first_claim, response_payload, ttl_seconds=60)

    replay_claim = service.claim("predict", "idem-1", payload)
    assert replay_claim is not None
    assert replay_claim.owner is False
    assert replay_claim.replay_response == response_payload


def test_idempotency_rejects_same_key_for_different_payload():
    service = IdempotencyService(client=FakeRedis())

    first_claim = service.claim("train", "idem-2", {"mode": "incremental"})
    assert first_claim is not None
    assert first_claim.owner is True

    try:
        service.claim(
            "train",
            "idem-2",
            {"mode": "full"},
            wait_timeout_seconds=0,
        )
    except ValueError as exc:
        assert "reused with a different payload" in str(exc)
    else:
        raise AssertionError("Expected ValueError for conflicting idempotency payload")
