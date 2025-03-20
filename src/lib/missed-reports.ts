import { TelegramSettings } from './telegram-service';
import { wasDailyReportSentToday, wasWeeklyReportSentThisWeek } from './report-history';

/**
 * Перевіряє, чи був пропущений щоденний звіт
 */
export const checkMissedDailyReport = (settings: TelegramSettings): boolean => {
  if (!settings.enabled || !settings.reportSchedule.daily) return false;

  const now = new Date();
  const [scheduledHours, scheduledMinutes] = settings.reportSchedule.dailyTime.split(':').map(Number);
  const scheduledTime = new Date(now);
  scheduledTime.setHours(scheduledHours, scheduledMinutes, 0, 0);

  // Перевіряємо, чи поточний час пізніше запланованого часу звіту
  // і чи не був звіт вже надісланий сьогодні
  return now > scheduledTime && !wasDailyReportSentToday();
};

/**
 * Перевіряє, чи був пропущений щотижневий звіт
 */
export const checkMissedWeeklyReport = (settings: TelegramSettings): boolean => {
  if (!settings.enabled || !settings.reportSchedule.weekly) return false;

  const now = new Date();
  const currentDay = now.getDay();
  const scheduledDay = settings.reportSchedule.weeklyDay;
  const [scheduledHours, scheduledMinutes] = settings.reportSchedule.weeklyTime.split(':').map(Number);

  // Якщо сьогодні день відправки і час пізніше запланованого
  if (currentDay === scheduledDay) {
    const scheduledTime = new Date(now);
    scheduledTime.setHours(scheduledHours, scheduledMinutes, 0, 0);
    return now > scheduledTime && !wasWeeklyReportSentThisWeek();
  }

  return false;
}; 