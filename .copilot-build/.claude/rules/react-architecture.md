# React Architecture Rules

## Component Hierarchy
```
Page (CollectiveConsciousness.jsx)
  └── Feature Container (ConsensusSignal.jsx)       # Fetches data, owns state
       ├── SectionCard (SessionProbabilityPanel.jsx) # Displays one concern
       ├── SectionCard (AlphaDisplay.jsx)
       ├── SectionCard (ExitStrategyPanel.jsx)
       └── ...
```

## State Ownership
- **Feature Container** owns all API calls and state
- **Sub-components** are pure: `props -> UI`
- **Never** fetch data in a sub-component (except with `useQuery`/`useSuspenseQuery`)
- **Always** wrap sub-components in `React.memo()` when they receive stable props

## Error Handling Contract
```javascript
const { data, isLoading, error } = useQuery(...);
// Renders:
// - isLoading → WarRoomLoader
// - error → "Service Unavailable" with retry
// - data → actual content
```
