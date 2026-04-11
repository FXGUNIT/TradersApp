# ADR-012: Continual Learning Strategy (EWC + Replay Buffer)

**ADR ID:** ADR-012
**Title:** Continual Learning Strategy (EWC + Replay Buffer)
**Status:** Accepted
**Date:** 2026-04-06
**Author:** Claude

## Context

The TradersApp ML system must continuously adapt to changing market conditions while:
- Preventing **catastrophic forgetting** — new training erases important patterns from old data
- Maintaining performance on established patterns while learning new ones
- Efficiently using limited training data (market data is scarce for rare events)
- Preserving knowledge from high-value historical patterns (Black Swan events, rare regime changes)

Without continual learning, the system faces:
- Degraded performance on historical patterns after retraining
- Loss of rare event detection capability
- Inability to adapt to regime shifts without full retraining
- Poor generalization to newly emerging market conditions

## Decision

We will implement **dual-strategy continual learning**:

### 1. Elastic Weight Consolidation (EWC)

EWC protects important weights from previous training by adding a regularization term:

```python
# EWC Loss = standard_loss + lambda * ewc_penalty
ewc_penalty = (lambda_ewc / 2) * sum(F_i * (theta_i - theta_star_i)^2)

# Where:
# - F_i = Fisher information matrix diagonal (importance of parameter i)
# - theta_i = current parameter value
# - theta_star_i = parameter value from optimal previous training
# - lambda_ewc = EWC penalty strength (hyperparameter)
```

**Fisher Information Calculation:**
```python
def compute_fisher_information(model, dataloader, params):
    """Compute diagonal Fisher Information Matrix."""
    fisher = {n: torch.zeros_like(p) for n, p in model.named_parameters()}

    for batch in dataloader:
        model.zero_grad()
        output = model(batch)
        loss = -output.log_likelihood()  # Negative log-likelihood
        loss.backward()

        for n, p in model.named_parameters():
            if p.grad is not None:
                fisher[n] += p.grad.data ** 2

    # Normalize by number of samples
    for n in fisher:
        fisher[n] /= len(dataloader)

    return fisher
```

### 2. Experience Replay Buffer

A prioritized replay buffer stores representative samples from all historical data:

```python
class PrioritizedReplayBuffer:
    """
    Experience replay with prioritized sampling.
    Prioritizes: rare events, high uncertainty, regime boundary samples.
    """

    def __init__(self, capacity: int = 100000, alpha: float = 0.6):
        self.capacity = capacity
        self.alpha = alpha  # Prioritization exponent
        self.buffer = []  # (sample, priority, metadata)
        self.priorities = np.zeros(capacity)
        self.position = 0

    def add(self, sample, priority=None, metadata=None):
        """Add sample to buffer."""
        if priority is None:
            priority = self._compute_priority(sample)

        if len(self.buffer) < self.capacity:
            self.buffer.append((sample, priority, metadata))
        else:
            self.buffer[self.position] = (sample, priority, metadata)

        self.priorities[self.position] = priority
        self.position = (self.position + 1) % self.capacity

    def _compute_priority(self, sample):
        """Compute priority based on sample characteristics."""
        base_priority = 1.0

        # Rare event boost (low frequency patterns)
        if sample.get('is_rare_event'):
            base_priority *= 3.0

        # Regime boundary boost (transition patterns)
        if sample.get('is_boundary'):
            base_priority *= 2.0

        # High uncertainty boost
        if sample.get('prediction_uncertainty', 0) > 0.3:
            base_priority *= 1.5

        # Recent data boost (recency bias)
        recency_factor = 1.0 + (sample.get('days_old', 0) * 0.01)
        base_priority /= recency_factor

        return base_priority ** self.alpha

    def sample(self, batch_size: int, beta: float = 0.4):
        """Sample batch with prioritization."""
        probs = self.priorities[:len(self.buffer)]
        probs /= probs.sum()

        indices = np.random.choice(len(self.buffer), batch_size, p=probs)
        samples = [self.buffer[i][0] for i in indices]

        # Compute importance sampling weights
        weights = (len(self.buffer) * probs[indices]) ** (-beta)
        weights /= weights.max()

        return samples, weights, indices
```

### 3. Training Pipeline Integration

```python
class ContinualLearner:
    """Combines EWC and replay buffer for continual learning."""

    def __init__(self, model, ewc_lambda=5000, buffer_capacity=100000):
        self.model = model
        self.ewc_lambda = ewc_lambda
        self.fisher_info = {}
        self.optimal_params = {}
        self.replay_buffer = PrioritizedReplayBuffer(buffer_capacity)

    def compute_ewc_penalty(self):
        """Compute EWC regularization penalty."""
        penalty = 0
        for name, param in self.model.named_parameters():
            if name in self.fisher_info:
                diff = param - self.optimal_params[name]
                penalty += (self.fisher_info[name] * diff.pow(2)).sum()
        return self.ewc_lambda * penalty

    def update_fisher_and_params(self, dataloader):
        """Update Fisher Information and optimal parameters after training."""
        self.fisher_info = compute_fisher_information(self.model, dataloader)
        self.optimal_params = {
            n: p.detach().clone()
            for n, p in self.model.named_parameters()
        }

    def continual_train_step(self, batch, replay_batch):
        """Single training step with EWC + replay."""
        # Standard loss on current batch
        current_loss = self.model.compute_loss(batch)

        # EWC penalty
        ewc_penalty = self.compute_ewc_penalty()

        # Replay loss (on samples from replay buffer)
        replay_loss = self.model.compute_loss(replay_batch)

        # Combined loss
        total_loss = current_loss + 0.5 * replay_loss + ewc_penalty

        total_loss.backward()
        self.optimizer.step()
        self.optimizer.zero_grad()

        return {
            'total_loss': total_loss.item(),
            'current_loss': current_loss.item(),
            'replay_loss': replay_loss.item(),
            'ewc_penalty': ewc_penalty.item()
        }
```

### Trigger Conditions

Retraining is triggered when:
- **Drift detected:** PSI > 0.1 for 5 consecutive days (per ADR-016)
- **Scheduled:** Every Sunday at 00:00 UTC
- **Manual:** Developer-triggered via MLflow UI
- **Performance degradation:** Rolling 7-day Sharpe drops below 0.5

## Consequences

### Positive
- **Catastrophic forgetting prevention:** EWC protects critical weights from overwriting
- **Rare event preservation:** Replay buffer ensures rare patterns remain accessible
- **Efficient data use:** Prioritization focuses training on high-value samples
- **Adaptive to regime shifts:** System learns new patterns while retaining old knowledge
- **Continuous improvement:** Model improves over time rather than degrading

### Negative
- **Computational overhead:** Fisher Information computation is expensive (O(params))
- **Memory overhead:** Replay buffer requires significant storage
- **Hyperparameter sensitivity:** lambda_ewc and buffer size require tuning
- **Training time:** EWC loss slows convergence
- **Complexity:** Additional complexity in training pipeline

### Neutral
- Requires careful monitoring of Fisher Information stability
- Replay buffer prioritization may bias toward certain patterns
- EWC assumes parameters can be meaningfully compared across tasks

## Alternatives Considered

### Pure Replay Only (no EWC)
- Pros: Simpler implementation, no Fisher computation
- Cons: Does not protect specific weights, only preserves data
- **Rejected** because we need weight-level protection, not just data preservation

### Progressive Neural Networks
- Pros: Adds new capacity for new tasks without forgetting
- Cons: Scales with number of tasks, complex architecture
- **Rejected** because our tasks are continuous, not distinct

### Memory-Aware Synapses (MAS)
- Pros: Simpler than Fisher Information, task-agnostic
- Cons: Less theoretically grounded than EWC
- **Rejected** because EWC is better established in literature

### No Continual Learning
- Pros: Simpler, standard training pipeline
- Cons: Suffers from catastrophic forgetting on regime changes
- **Rejected** because market adaptation is critical for trading performance

## References

- [Kirkpatrick et al. - Overcoming catastrophic forgetting in neural networks](https://arxiv.org/abs/1612.00796)
- [Ismail et al. - Prioritized Experience Replay](https://arxiv.org/abs/1511.05952)
- [Feather augment framework for continual learning](https://github.com/dsgt-birdclef/feather)
- Related ADRs: [ADR-016 Drift Detection](ADR-016-drift-detection.md) (triggers continual learning), [ADR-004 MLflow](ADR-004-mlflow-choice.md) (tracks training experiments)
