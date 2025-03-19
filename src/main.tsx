import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { initReportScheduler } from './lib/report-scheduler';

// Додаємо клас dark до html елементу для використання темної теми
document.documentElement.classList.add("dark");

// Ініціалізація теми
const initializeTheme = () => {
  const root = window.document.documentElement;
  const savedTheme = localStorage.getItem("theme") as "dark" | "light" | "system" | null;
  
  if (savedTheme) {
    if (savedTheme === "system") {
      const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
      root.classList.toggle("dark", systemTheme === "dark");
    } else {
      root.classList.toggle("dark", savedTheme === "dark");
    }
  } else {
    // За замовчуванням використовуємо темну тему
    root.classList.add("dark");
    localStorage.setItem("theme", "dark");
  }
};

// Ініціалізуємо тему перед рендерингом додатку
initializeTheme();

// Реєструємо Service Worker
if ('serviceWorker' in navigator && 'periodicSync' in navigator.serviceWorker) {
  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('/service-worker.ts', {
        scope: '/'
      });

      // Реєструємо періодичну синхронізацію
      const status = await navigator.permissions.query({
        name: 'periodic-background-sync' as PermissionName
      });

      if (status.state === 'granted') {
        await registration.periodicSync.register('check-reports', {
          minInterval: 15 * 60 * 1000 // Мінімальний інтервал 15 хвилин
        });
      }

      console.log('Service Worker зареєстровано успішно');
    } catch (error) {
      console.error('Помилка реєстрації Service Worker:', error);
    }
  });
}

// Ініціалізуємо планувальник звітів (як резервний варіант)
initReportScheduler();

// Встановлюємо слухач для автоматичної зміни теми при зміні системних налаштувань
window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (e) => {
  const savedTheme = localStorage.getItem("theme");
  if (savedTheme === "system") {
    document.documentElement.classList.toggle("dark", e.matches);
  }
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
