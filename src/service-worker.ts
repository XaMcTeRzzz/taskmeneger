/// <reference lib="webworker" />

import { 
  loadTelegramSettings, 
  sendTelegramMessage, 
  formatDailyReport, 
  formatWeeklyReport 
} from './lib/telegram-service';

import {
  wasDailyReportSentToday,
  wasWeeklyReportSentThisWeek,
  markDailyReportSent,
  markWeeklyReportSent
} from './lib/report-history';

declare const self: ServiceWorkerGlobalScope;

// Кеш версія
const CACHE_VERSION = 'v1';
const CACHE_NAME = `task-manager-${CACHE_VERSION}`;

// Встановлення Service Worker
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll([
        '/',
        '/index.html',
        '/manifest.json',
        // Додайте інші ресурси, які потрібно кешувати
      ]);
    })
  );
});

// Активація Service Worker
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name.startsWith('task-manager-') && name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
});

// Перевірка та відправка звітів
const checkAndSendReports = async () => {
  try {
    const settings = loadTelegramSettings();
    if (!settings.enabled) return;

    const now = new Date();
    const currentTimeStr = `${now.getHours()}:${now.getMinutes()}`;

    // Перевірка щоденного звіту
    if (settings.reportSchedule.daily && 
        currentTimeStr === settings.reportSchedule.dailyTime && 
        !wasDailyReportSentToday()) {
      console.log('Service Worker: Відправка щоденного звіту');
      const tasks = JSON.parse(localStorage.getItem('tasks') || '[]');
      const report = formatDailyReport(tasks, now);
      
      const success = await sendTelegramMessage(settings.botToken, settings.chatId, report);
      if (success) {
        markDailyReportSent();
      }
    }

    // Перевірка щотижневого звіту
    if (settings.reportSchedule.weekly && 
        now.getDay() === settings.reportSchedule.weeklyDay && 
        currentTimeStr === settings.reportSchedule.weeklyTime && 
        !wasWeeklyReportSentThisWeek()) {
      console.log('Service Worker: Відправка щотижневого звіту');
      const tasks = JSON.parse(localStorage.getItem('tasks') || '[]');
      const startDate = new Date(now);
      startDate.setDate(now.getDate() - now.getDay());
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 6);
      
      const report = formatWeeklyReport(tasks, startDate, endDate);
      
      const success = await sendTelegramMessage(settings.botToken, settings.chatId, report);
      if (success) {
        markWeeklyReportSent();
      }
    }
  } catch (error) {
    console.error('Service Worker: Помилка при перевірці звітів:', error);
  }
};

// Періодична синхронізація
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'check-reports') {
    event.waitUntil(checkAndSendReports());
  }
});

// Резервний варіант: перевірка кожні 15 хвилин
setInterval(checkAndSendReports, 15 * 60 * 1000); 