import { Task } from "@/types/task";
import { formatTaskCount, formatTimeForSpeech } from "./ukranian-numerals";

interface SiriSettings {
  greeting?: string;
  userName?: string;
  userTitle?: string;
}

/**
 * Форматує привітання для Siri
 */
export const formatGreeting = (settings: SiriSettings): string => {
  return `${settings.greeting || 'Привіт'}${settings.userName ? ', ' + settings.userName : ''}${settings.userTitle ? ', ' + settings.userTitle : ''}. Я Siri AI, ваш особистий асистент. Давайте подивимося на ваші задачі на сьогодні.`;
};

/**
 * Форматує текст для списку задач
 */
export const formatTasksText = (tasks: Task[], settings: SiriSettings): string => {
  if (tasks.length === 0) {
    return `На сьогодні у вас немає активних задач. Ви вільні, ${settings.userTitle || 'сер'}. Чим ще можу допомогти?`;
  }

  // Використовуємо утиліту для форматування кількості задач
  let tasksText = `На сьогодні у вас ${formatTaskCount(tasks.length)}. `;

  // Сортуємо задачі за часом
  const sortedTasks = [...tasks].sort((a, b) => a.date.getTime() - b.date.getTime());

  // Використовуємо утиліту для форматування часу
  sortedTasks.forEach(task => {
    const taskDate = new Date(task.date);
    const hours = taskDate.getHours();
    const minutes = taskDate.getMinutes();
    
    tasksText += `${formatTimeForSpeech(hours, minutes)} - ${task.title}. `;
  });

  return tasksText + "Чим ще можу допомогти?";
}; 