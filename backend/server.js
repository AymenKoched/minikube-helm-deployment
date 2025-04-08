const express = require('express');
const cors = require('cors');

const app = express();

app.use(cors());

app.get('/api/message', (req, res) => {
    res.json({ message: 'Hello from the backend!' });
});

const port = 7001 ;
app.listen(port, () => {
    console.log(`Backend server running at http://localhost:${port}`);
});
