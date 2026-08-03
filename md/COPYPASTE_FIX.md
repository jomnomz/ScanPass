# COPY-PASTE READY CODE

## File: src/Pages/AdminPages/AdminAttendace/AdminAttendance.jsx

Replace the entire `fetchAvailableDates` function (around lines 28-88) with:

```javascript
const fetchAvailableDates = useCallback(async () => {
  try {
    console.log("📅 Fetching all attendance dates (no limit)...");

    // Fetch ALL attendance dates without limit
    const { data: allAttendance, error: fetchError } = await supabase
      .from("attendance")
      .select("date", { count: "exact" })
      .order("date", { ascending: false });

    if (fetchError) throw fetchError;

    // Normalize dates to YYYY-MM-DD strings
    const normalize = (val) => {
      if (!val) return null;
      if (typeof val === "string") {
        const m = val.match(/^\d{4}-\d{2}-\d{2}/);
        if (m) return m[0];
        const dt = new Date(val);
        if (!isNaN(dt)) return dt.toISOString().split("T")[0];
        return null;
      }
      if (val instanceof Date) return val.toISOString().split("T")[0];
      return String(val);
    };

    const uniqueDates = [
      ...new Set(
        (allAttendance || [])
          .map((item) => normalize(item?.date))
          .filter(Boolean),
      ),
    ];

    console.log(
      `✅ Fetched ${allAttendance?.length || 0} rows → ${uniqueDates.length} unique dates`,
    );
    console.log(
      "📅 Date range:",
      uniqueDates.length > 0
        ? `${uniqueDates[uniqueDates.length - 1]} to ${uniqueDates[0]}`
        : "none",
    );
    console.log("📅 All available dates:", uniqueDates);

    setAvailableDates(uniqueDates);

    // Only set default date on first load
    if (!selectedDate) {
      const today = getCurrentPhilippinesDate();
      const todayExists = uniqueDates.includes(today);
      setSelectedDate(todayExists ? today : uniqueDates[0] || today);
    }
  } catch (err) {
    console.error("❌ Error fetching dates:", err);
    setAvailableDates([]);
  }
}, []);
```

---

## Context: Full AdminAttendance.jsx File Structure

The file looks like this:

```
import React, { useState, useEffect, useCallback, useRef } from 'react';
import styles from './AdminAttendance.module.css';
// ... other imports ...

function AdminAttendance() {
  // State declarations
  const [searchTerm, setSearchTerm] = useState('');
  // ... other state ...
  const [availableDates, setAvailableDates] = useState([]);

  // Helper functions
  const getCurrentPhilippinesDate = useCallback(() => { ... }, []);

  // THE FUNCTION TO REPLACE
  const fetchAvailableDates = useCallback(async () => {
    // REPLACE THIS ENTIRE FUNCTION with the code above
  }, []);

  // useEffect calls
  useEffect(() => { ... }, []);

  // Return JSX
  return (<main>...</main>);
}

export default AdminAttendance;
```

Just find the `const fetchAvailableDates = useCallback(async () => {` line and replace everything until the closing `}, []);`

---

## Verification Checklist

After pasting the code:

- [ ] File saves without syntax errors
- [ ] Dev server runs: `npm run dev`
- [ ] Open browser to app
- [ ] Navigate to Attendance page
- [ ] Click date picker button to open calendar
- [ ] Check browser console (F12 → Console tab)
- [ ] Look for logs:
  - [ ] "📅 Fetching all attendance dates (no limit)..."
  - [ ] "✅ Fetched XXXX rows → YYY unique dates"
  - [ ] "📅 Date range: ..."
  - [ ] "📅 All available dates: [Array with Jan dates]"
- [ ] Navigate calendar to January
- [ ] Check if **orange dots appear** on dates like Jan 15
- [ ] If dots don't appear, check:
  - Console for any errors
  - Array includes expected dates
  - Calendar component receives the dates

---

## Troubleshooting

**Q: Console shows "Fetched 1000 rows" still?**
A: Your browser cached the old code. Do Ctrl+Shift+Delete (clear cache), refresh page.

**Q: Still only shows April-June dates?**
A: Supabase might have hard limit. Need to implement batch fetching with offset.

**Q: Dates look wrong (e.g., "2026-06-24" but you see "2026-04-24")?**
A: Timezone issue. Update the normalize function to account for PH +8 offset.

**Q: Error in console about RPC?**
A: That's from the old code. It should be gone after replacing the function.
