import React, { useState, useRef } from 'react';
import { BrowserRouter as Router, Route, Switch } from 'react-router-dom';
import './App.css';

function App() {
  const [showAdminPrompt, setShowAdminPrompt] = useState(false);
  const inputRef = useRef(null);

  return (
    <Router>
      <Switch>
        {/* Add routes here */}
      </Switch>
    </Router>
  );
}

export default App;
