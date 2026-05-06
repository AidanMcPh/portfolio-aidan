// express server

const express = require("express");
const app = express();
const path = require("path");
const mysql = require('mysql2');

// ===== MySQL CONNECTION =====
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '',       // add your password here if you set one
  database: 'portfolio'
});

db.connect((err) => {
  if (err) throw err;
  console.log('MySQL connected');
});

app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, "public/index.html"));
});

// ===== CONTACT FORM ROUTE =====
app.post('/contact', (req, res) => {
  const { name, email, message } = req.body;
  db.query(
    'INSERT INTO contacts (name, email, message) VALUES (?, ?, ?)',
    [name, email, message],
    (err) => {
      if (err) return res.status(500).json({ ok: false });
      res.json({ ok: true });
    }
  );
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
