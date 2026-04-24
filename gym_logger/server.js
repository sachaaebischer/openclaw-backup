const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;
const LOGS_DIR = path.join(__dirname, 'logs');

// Ensure logs directory and files exist
function initLogs() {
  if (!fs.existsSync(LOGS_DIR)) {
    fs.mkdirSync(LOGS_DIR, { recursive: true });
  }
  const exercisesPath = path.join(LOGS_DIR, 'exercises.json');
  if (!fs.existsSync(exercisesPath)) {
    fs.writeFileSync(exercisesPath, JSON.stringify([], null, 2));
  }
  const sessionsPath = path.join(LOGS_DIR, 'sessions.csv');
  if (!fs.existsSync(sessionsPath)) {
    fs.writeFileSync(sessionsPath, 'date,time,exercise,weight,reps,set_note\n');
  }
}

initLogs();

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- Exercises API ---
app.get('/api/exercises', (req, res) => {
  const exercisesPath = path.join(LOGS_DIR, 'exercises.json');
  const exercises = JSON.parse(fs.readFileSync(exercisesPath, 'utf8'));
  res.json(exercises);
});

app.post('/api/exercises', (req, res) => {
  const { name, note } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });
  
  const exercisesPath = path.join(LOGS_DIR, 'exercises.json');
  const exercises = JSON.parse(fs.readFileSync(exercisesPath, 'utf8'));
  
  const newExercise = {
    id: Date.now().toString(),
    name: name.trim(),
    note: note || ''
  };
  exercises.push(newExercise);
  fs.writeFileSync(exercisesPath, JSON.stringify(exercises, null, 2));
  
  res.json(newExercise);
});

app.put('/api/exercises/:id', (req, res) => {
  const { id } = req.params;
  const { name, note } = req.body;
  
  const exercisesPath = path.join(LOGS_DIR, 'exercises.json');
  let exercises = JSON.parse(fs.readFileSync(exercisesPath, 'utf8'));
  
  const idx = exercises.findIndex(e => e.id === id);
  if (idx === -1) return res.status(404).json({ error: 'not found' });
  
  if (name !== undefined) exercises[idx].name = name.trim();
  if (note !== undefined) exercises[idx].note = note;
  
  fs.writeFileSync(exercisesPath, JSON.stringify(exercises, null, 2));
  res.json(exercises[idx]);
});

app.delete('/api/exercises/:id', (req, res) => {
  const { id } = req.params;
  const exercisesPath = path.join(LOGS_DIR, 'exercises.json');
  let exercises = JSON.parse(fs.readFileSync(exercisesPath, 'utf8'));
  exercises = exercises.filter(e => e.id !== id);
  fs.writeFileSync(exercisesPath, JSON.stringify(exercises, null, 2));
  res.json({ ok: true });
});

// --- Sessions API ---
app.post('/api/log-set', (req, res) => {
  const { date, exercise, weight, reps, set_note } = req.body;
  if (!exercise || weight === undefined || reps === undefined) {
    return res.status(400).json({ error: 'exercise, weight, reps are required' });
  }
  
  const sessionsPath = path.join(LOGS_DIR, 'sessions.csv');
  const now = new Date();
  const time = now.toTimeString().split(' ')[0];
  const dateStr = date || now.toISOString().split('T')[0];
  
  // Escape fields for CSV (handle commas and quotes)
  const escapeCsv = (str) => {
    if (str == null) return '';
    const s = String(str);
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  };
  
  const line = [dateStr, time, exercise, weight, reps, escapeCsv(set_note)].join(',') + '\n';
  fs.appendFileSync(sessionsPath, line);
  
  res.json({ ok: true, date: dateStr, time, exercise, weight, reps });
});

app.get('/api/sessions', (req, res) => {
  const sessionsPath = path.join(LOGS_DIR, 'sessions.csv');
  const content = fs.readFileSync(sessionsPath, 'utf8');
  const lines = content.trim().split('\n');
  if (lines.length <= 1) return res.json([]);
  
  const header = lines[0].split(',');
  const rows = lines.slice(1).map(line => {
    // Simple CSV parse
    const values = [];
    let current = '';
    let inQuotes = false;
    for (const char of line) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current);
    
    const row = {};
    header.forEach((h, i) => row[h] = values[i] || '');
    return row;
  });
  
  res.json(rows.reverse()); // Most recent first
});

app.delete('/api/sessions/:index', (req, res) => {
  const idx = parseInt(req.params.index);
  if (isNaN(idx) || idx < 0) {
    return res.status(400).json({ error: 'Invalid index' });
  }
  
  const sessionsPath = path.join(LOGS_DIR, 'sessions.csv');
  const content = fs.readFileSync(sessionsPath, 'utf8');
  const lines = content.trim().split('\n');
  if (lines.length <= 1) return res.status(404).json({ error: 'No sessions' });
  
  // API returns newest first, so index 0 = last line in file
  const fileIndex = lines.length - 1 - idx;
  if (fileIndex < 1 || fileIndex >= lines.length) {
    return res.status(404).json({ error: 'Index out of range' });
  }
  
  lines.splice(fileIndex, 1);
  fs.writeFileSync(sessionsPath, lines.join('\n') + '\n');
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`Gym logger running at http://localhost:${PORT}`);
});