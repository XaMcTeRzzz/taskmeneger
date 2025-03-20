/**
 * Сервіс для планування та відправки звітів
 */

import { 
  TelegramSettings, 
  loadTelegramSettings, 
  sendTelegramMessage, 
  formatDailyReport, 
  formatWeeklyReport 
} from './telegram-service';

import {
  wasDailyReportSentToday,
  wasWeeklyReportSentThisWeek,
  markDailyReportSent,
  markWeeklyReportSent,
  loadReportHistory
} from './report-history';

import {
  checkMissedDailyReport,
  checkMissedWeeklyReport
} from './missed-reports';

// Ключ для зберігання задач в localStorage
const TASKS_STORAGE_KEY = 'tasks';

// Інтерфейс для задачі
interface Task {
  id: string;
  title: string;
  description?: string;
  dueDate: string;
  completed: boolean;
  category?: string;
  priority?: 'low' | 'medium' | 'high';
  createdAt: string;
  updatedAt?: string;
}

/**
 * Завантажує задачі з localStorage
 */
const loadTasks = (): Task[] => {
  try {
    const tasksJson = localStorage.getItem(TASKS_STORAGE_KEY);
    return tasksJson ? JSON.parse(tasksJson) : [];
  } catch (error) {
    console.error('Помилка завантаження задач:', error);
    return [];
  }
};

/**
 * Безпечно перетворює рядок дати в об'єкт Date
 */
const safeParseDate = (dateStr: string): Date | null => {
  try {
    const date = new Date(dateStr);
    return isNaN(date.getTime()) ? null : date;
  } catch (error) {
    console.error('Помилка парсингу дати:', error);
    return null;
  }
};

/**
 * Фільтрує задачі за вказаним діапазоном дат
 */
const filterTasksByDateRange = (tasks: Task[], startDate: Date, endDate: Date): Task[] => {
  return tasks.filter(task => {
    const taskDate = safeParseDate(task.dueDate);
    if (!taskDate) return false;
    
    // Встановлюємо час на 0, щоб порівнювати тільки дати
    const taskDateOnly = new Date(taskDate.getFullYear(), taskDate.getMonth(), taskDate.getDate());
    const startDateOnly = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
    const endDateOnly = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
    
    return taskDateOnly >= startDateOnly && taskDateOnly <= endDateOnly;
  });
};

/**
 * Отримує задачі за вказаний день
 */
const getTasksForDay = (date: Date): Task[] => {
  // Повертаємо всі задачі, незалежно від дати
  return loadTasks();
};

/**
 * Отримує задачі за вказаний тиждень
 */
const getTasksForWeek = (date: Date): { tasks: Task[], startDate: Date, endDate: Date } => {
  const tasks = loadTasks();
  
  // Знаходимо початок тижня (понеділок)
  const startDate = new Date(date);
  const day = startDate.getDay();
  const diff = startDate.getDate() - day + (day === 0 ? -6 : 1); // Якщо неділя, то -6, інакше +1
  startDate.setDate(diff);
  startDate.setHours(0, 0, 0, 0);
  
  // Знаходимо кінець тижня (неділя)
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + 6);
  endDate.setHours(23, 59, 59, 999);
  
  // Отримуємо всі задачі
  return { 
    tasks: tasks, 
    startDate, 
    endDate 
  };
};

/**
 * Перевіряє, чи потрібно відправити щоденний звіт
 */
const shouldSendDailyReport = (settings: TelegramSettings): boolean => {
  if (!settings.enabled || !settings.reportSchedule.daily) {
    console.log('Щоденні звіти вимкнено');
    return false;
  }

  // Перевіряємо, чи звіт вже був надісланий сьогодні
  if (wasDailyReportSentToday()) {
    console.log('Щоденний звіт вже був надісланий сьогодні');
    return false;
  }
  
  const now = new Date();
  const [hours, minutes] = settings.reportSchedule.dailyTime.split(':').map(Number);
  const currentHours = now.getHours();
  const currentMinutes = now.getMinutes();
  
  // Перевіряємо, чи поточний час співпадає з запланованим
  const scheduledTime = new Date(now);
  scheduledTime.setHours(hours, minutes, 0, 0);
  
  // Відправляємо звіт, якщо поточний час >= запланованому часу
  const shouldSend = now >= scheduledTime;
  console.log(`Перевірка часу відправки: ${currentHours}:${currentMinutes} vs ${hours}:${minutes}`);
  console.log(`Результат перевірки: ${shouldSend ? 'Час відправляти' : 'Ще не час'}`);
  
  return shouldSend;
};

/**
 * Перевіряє, чи потрібно відправити щотижневий звіт
 */
const shouldSendWeeklyReport = (settings: TelegramSettings): boolean => {
  if (!settings.enabled || !settings.reportSchedule.weekly) {
    return false;
  }
  
  const now = new Date();
  const [hours, minutes] = settings.reportSchedule.weeklyTime.split(':').map(Number);
  
  return now.getDay() === settings.reportSchedule.weeklyDay && 
         now.getHours() === hours && 
         now.getMinutes() === minutes;
};

/**
 * Відправляє щоденний звіт
 */
const sendDailyReport = async (): Promise<boolean> => {
  const settings = loadTelegramSettings();
  
  if (!settings.enabled || !settings.reportSchedule.daily) {
    return false;
  }
  
  // Перевіряємо, чи звіт вже був надісланий сьогодні
  if (wasDailyReportSentToday()) {
    console.log('Щоденний звіт вже був надісланий сьогодні');
    return false;
  }
  
  const today = new Date();
  const tasks = getTasksForDay(today);
  const report = formatDailyReport(tasks, today);
  
  const success = await sendTelegramMessage(settings.botToken, settings.chatId, report);
  
  if (success) {
    // Зберігаємо інформацію про надісланий звіт
    markDailyReportSent();
  }
  
  return success;
};

/**
 * Відправляє щотижневий звіт
 */
const sendWeeklyReport = async (): Promise<boolean> => {
  const settings = loadTelegramSettings();
  
  if (!settings.enabled || !settings.reportSchedule.weekly) {
    return false;
  }
  
  // Перевіряємо, чи звіт вже був надісланий цього тижня
  if (wasWeeklyReportSentThisWeek()) {
    console.log('Щотижневий звіт вже був надісланий цього тижня');
    return false;
  }
  
  const today = new Date();
  const { tasks, startDate, endDate } = getTasksForWeek(today);
  const report = formatWeeklyReport(tasks, startDate, endDate);
  
  const success = await sendTelegramMessage(settings.botToken, settings.chatId, report);
  
  if (success) {
    // Зберігаємо інформацію про надісланий звіт
    markWeeklyReportSent();
  }
  
  return success;
};

/**
 * Ініціалізує планувальник звітів
 */
export const initReportScheduler = (): void => {
  console.log('Ініціалізуємо планувальник звітів...');
  
  // Перевіряємо пропущені звіти при ініціалізації
  const settings = loadTelegramSettings();
  
  // Перевіряємо щоденний звіт
  if (shouldSendDailyReport(settings)) {
    console.log('Відправляємо щоденний звіт...');
    sendDailyReport()
      .then(success => {
        if (success) {
          console.log('Щоденний звіт успішно відправлено');
        } else {
          console.error('Помилка відправки щоденного звіту');
        }
      })
      .catch(error => {
        console.error('Помилка під час відправки щоденного звіту:', error);
      });
  }

  // Перевіряємо щотижневий звіт
  if (checkMissedWeeklyReport(settings)) {
    console.log('Виявлено пропущений щотижневий звіт, відправляємо...');
    sendWeeklyReport()
      .then(success => {
        if (success) {
          console.log('Пропущений щотижневий звіт успішно відправлено');
        } else {
          console.error('Помилка відправки пропущеного щотижневого звіту');
        }
      })
      .catch(error => {
        console.error('Помилка під час відправки пропущеного щотижневого звіту:', error);
      });
  }

  // Перевіряємо кожні 15 секунд, чи потрібно відправити звіт
  setInterval(() => {
    try {
      // Перезавантажуємо налаштування при кожній перевірці
      const settings = loadTelegramSettings();
      
      // Отримуємо поточний час у форматі HH:MM
      const now = new Date();
      const currentTimeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
      
      console.log(`Перевірка розкладу звітів: ${currentTimeStr}`);
      
      // Перевіряємо щоденний звіт
      if (shouldSendDailyReport(settings)) {
        console.log(`Відправка щоденного звіту o ${currentTimeStr}`);
        
        sendDailyReport()
          .then(success => {
            if (success) {
              console.log('Щоденний звіт успішно відправлено');
            } else {
              console.error('Помилка відправки щоденного звіту');
            }
          })
          .catch(error => {
            console.error('Помилка під час відправки щоденного звіту:', error);
          });
      }
      
      // Перевіряємо щотижневий звіт
      if (shouldSendWeeklyReport(settings)) {
        console.log(`Відправка щотижневого звіту o ${currentTimeStr}`);
        
        sendWeeklyReport()
          .then(success => {
            if (success) {
              console.log('Щотижневий звіт успішно відправлено');
            } else {
              console.error('Помилка відправки щотижневого звіту');
            }
          })
          .catch(error => {
            console.error('Помилка під час відправки щотижневого звіту:', error);
          });
      }
    } catch (error) {
      console.error('Помилка в планувальнику звітів:', error);
    }
  }, 15000); // Перевіряємо кожні 15 секунд
  
  console.log('Планувальник звітів ініціалізовано');
};

/**
 * Відправляє тестовий звіт
 */
export const sendTestReport = async (): Promise<boolean> => {
  const settings = loadTelegramSettings();
  
  if (!settings.enabled) {
    return false;
  }
  
  try {
    // Отримуємо всі задачі
    const today = new Date();
    const reportDate = new Date(today);
    const tasks = getTasksForDay(today);
    
    // Використовуємо функцію форматування звіту
    const report = formatDailyReport(tasks, today);
    
    // Додаємо заголовок тестового звіту
    const testReport = `<b>🧪 ТЕСТОВИЙ ЗВІТ</b>\n<b>⏰ Час генерації:</b> ${reportDate.toLocaleTimeString('uk-UA')}\n\n${report}`;
    
    return await sendTelegramMessage(settings.botToken, settings.chatId, testReport);
  } catch (error) {
    console.error('Помилка відправки тестового звіту:', error);
    return false;
  }
};

/**
 * Перевіряє стан звітів та повертає діагностичну інформацію
 */
export const checkReportStatus = (): { 
  settings: boolean,
  schedule: {
    daily: boolean,
    dailyTime: string,
    weekly: boolean,
    weeklyDay: number,
    weeklyTime: string
  },
  lastSent: {
    daily?: string,
    weekly?: string
  },
  nextScheduled: {
    daily?: string,
    weekly?: string
  },
  errors: string[]
} => {
  const errors: string[] = [];
  const settings = loadTelegramSettings();
  const history = loadReportHistory();
  const now = new Date();

  // Перевіряємо базові налаштування
  if (!settings.enabled) {
    errors.push('Telegram сповіщення вимкнені');
  }
  if (!settings.botToken) {
    errors.push('Не налаштовано токен бота');
  }
  if (!settings.chatId) {
    errors.push('Не налаштовано ID чату');
  }

  // Розраховуємо наступний запланований час
  let nextDaily: string | undefined;
  let nextWeekly: string | undefined;

  if (settings.reportSchedule.daily) {
    const [hours, minutes] = settings.reportSchedule.dailyTime.split(':').map(Number);
    const nextDate = new Date(now);
    nextDate.setHours(hours, minutes, 0, 0);
    if (nextDate <= now) {
      nextDate.setDate(nextDate.getDate() + 1);
    }
    nextDaily = nextDate.toLocaleString('uk-UA');
  }

  if (settings.reportSchedule.weekly) {
    const [hours, minutes] = settings.reportSchedule.weeklyTime.split(':').map(Number);
    const nextDate = new Date(now);
    nextDate.setHours(hours, minutes, 0, 0);
    
    const currentDay = now.getDay();
    const targetDay = settings.reportSchedule.weeklyDay;
    const daysUntilTarget = (targetDay + 7 - currentDay) % 7;
    
    nextDate.setDate(nextDate.getDate() + daysUntilTarget);
    if (nextDate <= now) {
      nextDate.setDate(nextDate.getDate() + 7);
    }
    nextWeekly = nextDate.toLocaleString('uk-UA');
  }

  return {
    settings: settings.enabled,
    schedule: {
      daily: settings.reportSchedule.daily,
      dailyTime: settings.reportSchedule.dailyTime,
      weekly: settings.reportSchedule.weekly,
      weeklyDay: settings.reportSchedule.weeklyDay,
      weeklyTime: settings.reportSchedule.weeklyTime
    },
    lastSent: {
      daily: history.lastDailyReport?.date,
      weekly: history.lastWeeklyReport?.date
    },
    nextScheduled: {
      daily: nextDaily,
      weekly: nextWeekly
    },
    errors
  };
}; 