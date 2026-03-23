import React, { useState } from 'react';
import { BrowserRouter as Router, Route, Switch } from 'react-router-dom';
import './App.css';

function App() {
  const [showAdminPrompt, setShowAdminPrompt] = useState(false);

  return (
    <Router>
      <Switch>
        {/* Add routes here */}
      </Switch>
    </Router>
  );
}

export default App;
