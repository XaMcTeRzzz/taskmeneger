import { TelegramSettings } from './telegram-service';
import { wasDailyReportSentToday, wasWeeklyReportSentThisWeek } from './report-history';

/**
 * Перевіряє, чи був пропущений щоденний звіт
 * Ця функція більше не використовується, оскільки логіка перенесена в shouldSendDailyReport
 * @deprecated
 */
export const checkMissedDailyReport = (settings: TelegramSettings): boolean => {
  return false;
};

/**
 * Перевіряє, чи був пропущений щотижневий звіт
 */
export const checkMissedWeeklyReport = (settings: TelegramSettings): boolean => {
  if (!settings.enabled || !settings.reportSchedule.weekly) return false;

  // Перевіряємо, чи звіт вже був надісланий цього тижня
  if (wasWeeklyReportSentThisWeek()) {
    return false;
  }

  const now = new Date();
  const currentDay = now.getDay();
  const scheduledDay = settings.reportSchedule.weeklyDay;
  const [scheduledHours, scheduledMinutes] = settings.reportSchedule.weeklyTime.split(':').map(Number);

  // Якщо сьогодні день відправки і час пізніше запланованого
  if (currentDay === scheduledDay) {
    const scheduledTime = new Date(now);
    scheduledTime.setHours(scheduledHours, scheduledMinutes, 0, 0);
    return now > scheduledTime;
  }

  return false;
}; 