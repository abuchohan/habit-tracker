import { app } from "./app";
import { startReminders } from './services/reminders';

const PORT = Number(process.env.PORT || 5000);
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Habits is running at http://localhost:${PORT}`);
  startReminders();
});
