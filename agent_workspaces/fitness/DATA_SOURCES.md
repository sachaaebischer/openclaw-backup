# Data Sources — Your Toolkit as Coach

You have access to three health data sources via MCP tools, plus the gym logger data. Here's what you've got:

---

## 🏋️ Gym Logger (CSV)
**Location:** `/home/sacha/Projects/gym-logger/logs/sessions.csv`

Format: `date,time,exercise,weight,reps,set_note`

Also: `/home/sacha/Projects/gym-logger/logs/exercises.json` — exercise definitions

**Note:** The CSV may be empty (no workouts logged yet). Check both files.

Example:
```
2026-04-22,10:30,Bench Press,80,8,Feeling strong
2026-04-22,10:35,Bench Press,80,6,Last set
```

**What to look for:** progression over time, exercise variety, volume per muscle group.

---

## 💍 Ultrahuman Ring
**MCP tool:** `ultrahuman_metrics` — date required (YYYY-MM-DD)

**Data available:**
- Heart rate time series (resting ~46-57 bpm)
- Recovery index (0-100)
- Sleep: stages, restorative sleep %, cycles, tosses & turns
- Movement index, active minutes
- Sleep HR (lowest resting heart rate during sleep)
- HRV (if available)
- VO2 Max (if available)
- Glucose-related metrics (if user has CGM)

---

## 🚴 Garmin Connect
**MCP prefix:** `garmin__` — 40+ endpoints

**Key ones for coaching:**
- `garmin__get_daily_summary` — steps, calories, HR, stress, body battery
- `garmin__get_activities` / `garmin__get_activities_by_date` — all activities
- `garmin__get_last_activity` — most recent activity
- `garmin__get_sleep_data` / `garmin__get_sleep_data_range` — sleep stages, duration, score
- `garmin__get_hrv` / `garmin__get_hrv_range` — HRV trends
- `garmin__get_training_readiness` / `garmin__get_training_status` — readiness to train
- `garmin__get_vo2max` / `garmin__get_vo2max_range` — aerobic fitness
- `garmin__get_steps` / `garmin__get_steps_chart` — daily steps
- `garmin__get_stress` / `garmin__get_stress_range` — stress levels
- `garmin__get_body_battery` — energy reserves
- `garmin__get_progress_summary` — distance/duration/calories over time

---

## ❤️ Polar H10 (Chest Strap)
**MCP prefix:** `polar__` — 25+ endpoints

**Key ones for coaching:**
- `polar__get_exercises` — exercise sessions (HR, duration, zones)
- `polar__get_nightly_recharge` — overnight recovery (ANS charge, HRV, breathing)
- `polar__get_sleep` / `polar__get_sleep_range` — sleep stages and scores
- `polar__get_cardio_load` / `polar__get_cardio_load_range` — training strain
- `polar__get_continuous_heart_rate` / `polar__get_continuous_heart_rate_range` — 5-min interval HR
- `polar__get_daily_activity` / `polar__get_daily_activity_range` — steps, calories, active time
- `polar__get_sleepwise_alertness` — predicted alertness throughout the day

---

## 📋 Suggested Workflow

1. **Morning check:** Ultrahuman recovery index + Garmin training readiness + Polar nightly recharge
2. **Post-workout:** Gym logger CSV entry confirmation, Garmin activity if outdoor
3. **Weekly review:** Pull 7-day data from all sources → assess training load vs recovery balance
4. **Plan adjustments:** Use HRV trends, sleep quality, and training status to adjust upcoming workout intensity

---

## ⚠️ Important

- All health data is **personal and private** — never share it externally
- The gym logger CSV is at `~/Projects/gym-logger/logs/` — you have read access
- When analyzing workouts, cross-reference with the day's HR/HRV/recovery data
