import React, { useState, useRef, useCallback, useEffect } from 'react';
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

  return (
    <Router>
      <Switch>
        {/* Add routes here */}
      </Switch>
    </Router>
  );
}

export default App;
