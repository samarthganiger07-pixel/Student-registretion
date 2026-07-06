// frontend/src/App.jsx
import { useState, useEffect } from 'react';
import './App.css';

const API_URL = 'http://localhost:5000';

function App() {
  const [habits, setHabits] = useState([]);
  const [checkinsByHabit, setCheckinsByHabit] = useState({});
  const [newHabitName, setNewHabitName] = useState('');
  const [loading, setLoading] = useState(true);

  const refreshAll = async () => {
    try {
      const res = await fetch(`${API_URL}/habits`);
      if (!res.ok) throw new Error('Failed to fetch habits');
      const habitsData = await res.json();
      setHabits(habitsData);

      const checkinsMap = {};
      for (const habit of habitsData) {
        const checkinsRes = await fetch(`${API_URL}/habits/${habit.id}/checkins`);
        if (checkinsRes.ok) {
          const checkinsData = await checkinsRes.json();
          checkinsMap[habit.id] = checkinsData;
        }
      }
      setCheckinsByHabit(checkinsMap);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshAll();
  }, []);

  const handleAddHabit = async () => {
    const trimmed = newHabitName.trim();
    if (!trimmed) return;
    
    try {
      await fetch(`${API_URL}/habits`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed })
      });
      setNewHabitName('');
      refreshAll();
    } catch (error) {
      console.error(error);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleAddHabit();
    }
  };

  const handleCheckIn = async (habitId) => {
    try {
      await fetch(`${API_URL}/habits/${habitId}/checkin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      refreshAll();
    } catch (error) {
      console.error(error);
    }
  };

  const handleDelete = async (habitId) => {
    try {
      await fetch(`${API_URL}/habits/${habitId}`, {
        method: 'DELETE'
      });
      refreshAll();
    } catch (error) {
      console.error(error);
    }
  };

  const todayStr = new Date().toISOString().split('T')[0];

  const getLast7Days = () => {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      days.push({
        dateStr: d.toISOString().split('T')[0],
        dayOfMonth: d.getDate()
      });
    }
    return days;
  };

  const past7Days = getLast7Days();

  return (
    <div className="app-container">
      <h1>🔥 Habit Tracker</h1>
      
      <div className="new-habit-card">
        <input 
          type="text" 
          placeholder="e.g. Drink 2L water" 
          value={newHabitName}
          onChange={(e) => setNewHabitName(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <button onClick={handleAddHabit}>Add Habit</button>
      </div>

      <div className="habit-list">
        {loading ? (
          <p className="status-text">Loading your habits...</p>
        ) : habits.length === 0 ? (
          <p className="status-text">No habits yet. Add one above to get started!</p>
        ) : (
          habits.map(habit => {
            const habitCheckins = checkinsByHabit[habit.id] || [];
            const isCheckedInToday = habitCheckins.includes(todayStr);

            return (
              <div key={habit.id} className="habit-card">
                <h3>{habit.name}</h3>
                
                <p className={`streak-text ${habit.streak > 0 ? 'active-streak' : ''}`}>
                  {habit.streak > 0 
                    ? `🔥 ${habit.streak} day streak` 
                    : "No streak yet — check in today!"}
                </p>

                <button 
                  className={`checkin-btn ${isCheckedInToday ? 'checked' : ''}`}
                  onClick={() => handleCheckIn(habit.id)}
                  disabled={isCheckedInToday}
                >
                  {isCheckedInToday ? "✅ Checked in today" : "Check In"}
                </button>

                <div className="history-boxes">
                  {past7Days.map((dayInfo, idx) => {
                    const isDone = habitCheckins.includes(dayInfo.dateStr);
                    return (
                      <div key={idx} className={`history-box ${isDone ? 'done' : 'not-done'}`}>
                        {dayInfo.dayOfMonth}
                      </div>
                    );
                  })}
                </div>

                <button className="delete-btn" onClick={() => handleDelete(habit.id)}>
                  Delete Habit
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export default App;