/**
 * Інтерфейс для історії звітів
 */
interface ReportHistory {
  lastWeeklyReport?: {
    date: string;
    weekNumber: number;
    year: number;
  };
  lastDailyReport?: {
    date: string;
  };
}

const REPORT_HISTORY_KEY = 'report_history';

/**
 * Завантажує історію звітів з localStorage
 */
export const loadReportHistory = (): ReportHistory => {
  try {
    const saved = localStorage.getItem(REPORT_HISTORY_KEY);
    return saved ? JSON.parse(saved) : {};
  } catch (error) {
    console.error('Помилка при завантаженні історії звітів:', error);
    return {};
  }
};

/**
 * Зберігає історію звітів в localStorage
 */
export const saveReportHistory = (history: ReportHistory): void => {
  try {
    localStorage.setItem(REPORT_HISTORY_KEY, JSON.stringify(history));
  } catch (error) {
    console.error('Помилка при збереженні історії звітів:', error);
  }
};

/**
 * Отримує номер тижня для заданої дати
 */
const getWeekNumber = (date: Date): number => {
  const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
  const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
  return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
};

/**
 * Перевіряє, чи був вже надісланий щоденний звіт сьогодні
 */
export const wasDailyReportSentToday = (): boolean => {
  const history = loadReportHistory();
  if (!history.lastDailyReport) return false;
  
  const today = new Date().toISOString().split('T')[0];
  return history.lastDailyReport.date === today;
};

/**
 * Перевіряє, чи був вже надісланий щотижневий звіт цього тижня
 */
export const wasWeeklyReportSentThisWeek = (): boolean => {
  const history = loadReportHistory();
  if (!history.lastWeeklyReport) return false;
  
  const now = new Date();
  const currentWeek = getWeekNumber(now);
  const currentYear = now.getFullYear();
  
  return history.lastWeeklyReport.weekNumber === currentWeek && 
         history.lastWeeklyReport.year === currentYear;
};

/**
 * Записує інформацію про надісланий щоденний звіт
 */
export const markDailyReportSent = (): void => {
  const history = loadReportHistory();
  history.lastDailyReport = {
    date: new Date().toISOString().split('T')[0]
  };
  saveReportHistory(history);
};

/**
 * Записує інформацію про надісланий щотижневий звіт
 */
export const markWeeklyReportSent = (): void => {
  const now = new Date();
  const history = loadReportHistory();
  history.lastWeeklyReport = {
    date: now.toISOString().split('T')[0],
    weekNumber: getWeekNumber(now),
    year: now.getFullYear()
  };
  saveReportHistory(history);
}; 