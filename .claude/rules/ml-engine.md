# ML Engine Architecture Rules

## Models Follow Strict Patterns
Every ML model follows one of these patterns:
```python
# Pattern 1: Classifier
class DirectionModel:
    def __init__(self): ...
    def train(self, X, y): ...
    def predict(self, X) -> dict: ...  # {signal, confidence, probability}

# Pattern 2: Regressor
class AlphaModel:
    def train(self, X, y): ...
    def predict(self, X) -> dict: ...  # {alpha_score, confidence, components}

# Pattern 3: Ensemble
class RegimeEnsemble:
    def predict(self, X) -> dict: ...  # merges HMM + FP-FK + Anomalous Diffusion
```

## Every Model Has:
1. `train(X, y)` — with TimeSeriesSplit CV
2. `predict(X) -> dict` — with explicit return shape
3. `get_feature_importance()` — SHAP or permutation importance
4. Guardrails on all outputs
5. Graceful fallback when data insufficient

## No Global State in ML Engine
```
BAD:  global_model = None
      def get_model(): ...
GOOD: class DirectionModel:
          _instance = None
          @classmethod
          def get_instance(cls): ...
```
Use singletons or dependency injection. No global mutable state.
