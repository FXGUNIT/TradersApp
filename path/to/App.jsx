import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { BrowserRouter as Router, Route, Switch } from 'react-router-dom';
import './App.css';

function App() {
  const [showAdminPrompt, setShowAdminPrompt] = useState(false);
  const inputRef = useRef(null);

  const handleLogin = useCallback(() => {
    // Add login logic here
    console.log('Login button clicked');
  }, []);

  useEffect(() => {
    // Example side effect: log user activity to the console
    console.log(`User logged in`);
  }, [showAdminPrompt]);

  const memoizedValue = useMemo(() => {
    return 'This value is computed once and reused';
  }, []); // Empty dependency array means it will only compute once

  return (
    <Router>
      <Switch>
        {/* Add routes here */}
      </Switch>
    </Router>
  );
}

export default App;
