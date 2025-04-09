import logo from './logo.svg';
import './App.css';
import {useEffect, useState} from "react";
import axios from "axios";

function App() {
    const [message, setMessage] = useState('');
    const host = window._env_?.REACT_APP_BACKEND_HOST || process.env.REACT_APP_BACKEND_HOST;
    const port = window._env_?.REACT_APP_BACKEND_PORT || process.env.REACT_APP_BACKEND_PORT;
    console.log({host, port});

    useEffect(() => {
        axios.get(`http://${host}:${port}/api/message`)
            .then(response => setMessage(response.data.message))
            .catch(error => console.error('Error fetching data:', error));
    }, [host, port]);

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
