// backend/index.js
const express = require('express');
const cors = require('cors');
const Database = require('better-sqlite3');

const app = express();
app.use(cors());
app.use(express.json());

const db = new Database('data.db');

// Create habits table
db.exec(`
  CREATE TABLE IF NOT EXISTS habits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL
  )
`);

// Create checkins table
db.exec(`
  CREATE TABLE IF NOT EXISTS checkins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    habit_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    checked_at TEXT NOT NULL,
    UNIQUE(habit_id, date)
  )
`);

/*
  calculateStreak(habitId)
  This function counts the consecutive days a habit has been checked in.
  It queries the checkins table ordered by date descending.
  Starting from today, it counts backwards checking if a day exists in the check-ins.
  If neither today nor yesterday has a check-in, the streak is 0.
  If today isn't checked in but yesterday is, it maintains the streak starting from yesterday.
*/
function calculateStreak(habitId) {
  const rows = db.prepare('SELECT date FROM checkins WHERE habit_id = ? ORDER BY date DESC').all(habitId);
  if (rows.length === 0) return 0;

  const checkinDates = new Set(rows.map(r => r.date));
  
  const today = new Date();
  const formatString = (d) => d.toISOString().split('T')[0];
  const todayStr = formatString(today);
  
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = formatString(yesterday);

  if (!checkinDates.has(todayStr) && !checkinDates.has(yesterdayStr)) {
    return 0;
  }

  let currentStreak = 0;
  let currentDate = new Date(today);

  if (!checkinDates.has(todayStr) && checkinDates.has(yesterdayStr)) {
    currentDate = new Date(yesterday);
  }

  while (checkinDates.has(formatString(currentDate))) {
    currentStreak++;
    currentDate.setDate(currentDate.getDate() - 1);
  }

  return currentStreak;
}

// ROUTE A - POST /habits: create a new habit.
app.post('/habits', (req, res) => {
  const name = req.body.name?.trim();
  if (!name) return res.status(400).json({ error: "name is required" });
  
  const created_at = new Date().toISOString();
  const stmt = db.prepare('INSERT INTO habits (name, created_at) VALUES (?, ?)');
  const info = stmt.run(name, created_at);
  
  const newHabit = db.prepare('SELECT * FROM habits WHERE id = ?').get(info.lastInsertRowid);
  newHabit.streak = 0;
  res.status(201).json(newHabit);
});

// ROUTE B - GET /habits: list all habits along with each one's current streak.
app.get('/habits', (req, res) => {
  const habits = db.prepare('SELECT * FROM habits ORDER BY created_at ASC').all();
  habits.forEach(habit => {
    habit.streak = calculateStreak(habit.id);
  });
  res.status(200).json(habits);
});

// ROUTE C - POST /habits/:id/checkin: mark a habit as done for a specific date (defaults to today).
app.post('/habits/:id/checkin', (req, res) => {
  const habitId = req.params.id;
  const date = req.body.date || new Date().toISOString().split('T')[0];
  
  const habit = db.prepare('SELECT * FROM habits WHERE id = ?').get(habitId);
  if (!habit) return res.status(404).json({ error: "Habit not found" });

  const checked_at = new Date().toISOString();
  try {
    const stmt = db.prepare('INSERT INTO checkins (habit_id, date, checked_at) VALUES (?, ?, ?)');
    const info = stmt.run(habitId, date, checked_at);
    
    const newCheckin = db.prepare('SELECT * FROM checkins WHERE id = ?').get(info.lastInsertRowid);
    newCheckin.streak = calculateStreak(habitId);
    res.status(201).json(newCheckin);
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE' || error.message.includes('UNIQUE constraint')) {
      return res.status(409).json({ error: "Already checked in for this date" });
    }
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ROUTE D - GET /habits/:id/checkins: return all check-in dates for one habit.
app.get('/habits/:id/checkins', (req, res) => {
  const habitId = req.params.id;
  const habit = db.prepare('SELECT * FROM habits WHERE id = ?').get(habitId);
  if (!habit) return res.status(404).json({ error: "Habit not found" });

  const rows = db.prepare('SELECT date FROM checkins WHERE habit_id = ? ORDER BY date DESC').all(habitId);
  res.status(200).json(rows.map(r => r.date));
});

// ROUTE E - DELETE /habits/:id/checkin/:date: undo a check-in for a specific date.
app.delete('/habits/:id/checkin/:date', (req, res) => {
  const stmt = db.prepare('DELETE FROM checkins WHERE habit_id = ? AND date = ?');
  stmt.run(req.params.id, req.params.date);
  res.status(200).json({ message: "Checkin removed" });
});

// ROUTE F - DELETE /habits/:id: delete a habit entirely, along with all of its check-in history.
app.delete('/habits/:id', (req, res) => {
  const habitId = req.params.id;
  db.prepare('DELETE FROM checkins WHERE habit_id = ?').run(habitId);
  db.prepare('DELETE FROM habits WHERE id = ?').run(habitId);
  res.status(200).json({ message: `Habit ${habitId} and its checkins deleted` });
});

app.listen(5000, () => {
  console.log("Server running on http://localhost:5000");
});