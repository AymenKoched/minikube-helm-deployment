import logo from './logo.svg';
import './App.css';
import {useEffect, useState} from "react";
import axios from "axios";

function App() {
    const [message, setMessage] = useState('');

    useEffect(() => {
        axios.get(`http://localhost:7001/api/message`)
            .then(response => setMessage(response.data.message))
            .catch(error => console.error('Error fetching data:', error));
    }, [BACKEND_URL]);

    return (
    <div className="App">
      <header className="App-header">
        <img src={logo} className="App-logo" alt="logo" />
        <p>{message}</p>
      </header>
    </div>
  );
}

export default App;
