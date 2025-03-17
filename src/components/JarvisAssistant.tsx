import React, { useState, useEffect, useRef } from "react";
import { Volume2, VolumeX, Mic, MicOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { Task } from "@/components/TasksList";
import { SpeechRecognition, SpeechRecognitionEvent } from "@/types/speech-recognition";

interface JarvisAssistantProps {
  tasks: Task[];
  selectedDate?: Date;
  onFilterDate?: (date: Date) => void;
  onAddTask?: () => void;
  onListeningChange?: (isListening: boolean) => void;
}

// Перелік команд, які розуміє Джарвіс
const COMMANDS = {
  ACTIVATE: ["джарвіс", "jarvis", "джарвис", "jarvis", "жарвіс", "дж", "жарвіс"],
  READ_TASKS: ["задачі", "задача", "мої задачі", "всі задачі", "що заплановано", "розклад"],
  EDIT_TASK: ["редагувати", "змінити", "оновити"],
  STOP: ["стоп", "зупинись", "замовкни", "перестань", "досить", "stop"],
};

// Ключ для localStorage
const ACTIVE_TASKS_STORAGE_KEY = "jarvis_active_tasks";

// Додаємо після інших ключів для localStorage
const JARVIS_SETTINGS_KEY = "jarvis_settings";

// Інтерфейс для налаштувань Джарвіса
interface JarvisSettings {
  greeting: string;
  userName: string;
  userTitle: string;
  googleApiKey: string;
  useGoogleTTS: boolean;
}

// Дефолтні налаштування
const DEFAULT_SETTINGS: JarvisSettings = {
  greeting: "Да",
  userName: "",
  userTitle: "сер",
  googleApiKey: "",
  useGoogleTTS: false
};

// Після імпортів додамо інтерфейс для голосів
interface VoiceOption {
  voice: SpeechSynthesisVoice;
  name: string;
  lang: string;
  isNative: boolean;
}

// Функція для форматування часу
const formatTime = (date: Date): string => {
  return new Intl.DateTimeFormat('uk', {
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
};

// Створюємо компонент з підтримкою ref
export const JarvisAssistant = React.forwardRef<
  { startListening: () => void },
  JarvisAssistantProps
>(({ tasks, selectedDate, onFilterDate, onAddTask, onListeningChange }, ref) => {
  // Стан прослуховування
  const [isListening, setIsListening] = useState(false);
  // Стан відтворення відповіді Джарвіса 
  const [isSpeaking, setIsSpeaking] = useState(false);
  // Анімована іконка
  const [waveform, setWaveform] = useState<number[]>([]);
  // Текст розпізнаної команди
  const [recognizedText, setRecognizedText] = useState("");
  // Кеш активних задач
  const [cachedTasks, setCachedTasks] = useState<Task[]>([]);
  // Додамо стан для збереження доступних голосів
  const [availableVoices, setAvailableVoices] = useState<VoiceOption[]>([]);
  // Вибраний голос
  const [selectedVoice, setSelectedVoice] = useState<SpeechSynthesisVoice | null>(null);

  // Референції для об'єктів розпізнавання і синтезу мови
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const speechSynthesisRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Додаємо стан для налаштувань Джарвіса
  const [jarvisSettings, setJarvisSettings] = useState<JarvisSettings>(DEFAULT_SETTINGS);
  // Стан для показу діалогу налаштувань
  const [showSettings, setShowSettings] = useState<boolean>(false);

  // Експортуємо функцію startListening через ref
  React.useImperativeHandle(ref, () => ({
    startListening: () => {
      startListening();
    }
  }));

  // Оновлюємо батьківський компонент про зміну стану прослуховування
  useEffect(() => {
    if (onListeningChange) {
      onListeningChange(isListening);
    }
  }, [isListening, onListeningChange]);

  // При завантаженні компонента, завантажуємо збережені задачі
  useEffect(() => {
    loadCachedTasks();
  }, []);

  // При зміні задач, оновлюємо кеш
  useEffect(() => {
    if (tasks && Array.isArray(tasks) && tasks.length > 0) {
      saveActiveTasks(tasks);
    }
  }, [tasks]);

  // Додамо ефект для завантаження доступних голосів
  useEffect(() => {
    // Функція для завантаження доступних голосів
    const loadVoices = () => {
      if (window.speechSynthesis) {
        // Отримуємо всі доступні голоси
        const voices = window.speechSynthesis.getVoices();
        if (voices.length > 0) {
          // Мапимо голоси в більш зручний формат
          const voiceOptions: VoiceOption[] = voices.map(voice => ({
            voice: voice,
            name: voice.name,
            lang: voice.lang,
            isNative: voice.localService
          }));
          
          console.log("Доступні голоси:", voiceOptions);
          setAvailableVoices(voiceOptions);
          
          // Вибираємо найкращий голос для української мови або будь-який інший доступний
          selectBestVoice(voiceOptions);
        }
      }
    };
    
    // Завантажуємо голоси при ініціалізації
    loadVoices();
    
    // У Chrome голоси можуть завантажуватися асинхронно
    if (window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
    
    return () => {
      if (window.speechSynthesis) {
        window.speechSynthesis.onvoiceschanged = null;
      }
    };
  }, []);
  
  // Функція для вибору найкращого голосу
  const selectBestVoice = (voices: VoiceOption[]) => {
    // Спробуємо знайти український чоловічий голос
    let bestVoice = voices.find(v => v.lang.includes('uk') && v.isNative && 
      (v.name.toLowerCase().includes('male') || v.name.toLowerCase().includes('man')));
    
    // Якщо українського чоловічого голосу немає, спробуємо знайти російський чоловічий
    if (!bestVoice) {
      bestVoice = voices.find(v => v.lang.includes('ru') && v.isNative && 
        (v.name.toLowerCase().includes('male') || v.name.toLowerCase().includes('man')));
    }
    
    // Якщо немає ні українського, ні російського чоловічого, візьмемо будь-який чоловічий голос
    if (!bestVoice) {
      bestVoice = voices.find(v => v.name.toLowerCase().includes('male') || v.name.toLowerCase().includes('man'));
    }
    
    // Якщо взагалі нічого немає, візьмемо перший доступний
    if (!bestVoice && voices.length > 0) {
      bestVoice = voices[0];
    }
    
    if (bestVoice) {
      console.log("Вибраний голос:", bestVoice.name, bestVoice.lang);
      setSelectedVoice(bestVoice.voice);
    }
  };

  // Функція для збереження активних задач
  const saveActiveTasks = (tasksList: Task[]) => {
    try {
      // Фільтруємо тільки активні задачі
      const activeTasks = tasksList.filter(task => !task.completed);
      
      if (activeTasks.length > 0) {
        // Зберігаємо в localStorage
        localStorage.setItem(ACTIVE_TASKS_STORAGE_KEY, JSON.stringify(activeTasks));
        console.log("Задачі збережено в кеш:", activeTasks.length);
        setCachedTasks(activeTasks);
      }
    } catch (error) {
      console.error("Помилка при збереженні задач:", error);
    }
  };

  // Функція для завантаження збережених задач
  const loadCachedTasks = () => {
    try {
      const savedTasks = localStorage.getItem(ACTIVE_TASKS_STORAGE_KEY);
      if (savedTasks) {
        const parsedTasks = JSON.parse(savedTasks) as Task[];
        
        // Перевіряємо формат і конвертуємо рядкові дати в об'єкти Date
        const validTasks = parsedTasks.map(task => ({
          ...task,
          date: new Date(task.date)
        }));
        
        console.log("Завантажено задач з кешу:", validTasks.length);
        setCachedTasks(validTasks);
        return validTasks;
      }
    } catch (error) {
      console.error("Помилка при завантаженні задач:", error);
    }
    return [];
  };

  // Завантажуємо налаштування при ініціалізації
  useEffect(() => {
    loadJarvisSettings();
  }, []);

  // Функція для завантаження налаштувань Джарвіса
  const loadJarvisSettings = () => {
    try {
      const savedSettings = localStorage.getItem(JARVIS_SETTINGS_KEY);
      if (savedSettings) {
        const parsedSettings = JSON.parse(savedSettings) as JarvisSettings;
        setJarvisSettings(parsedSettings);
        console.log("Завантажено налаштування Джарвіса:", parsedSettings);
      }
    } catch (error) {
      console.error("Помилка при завантаженні налаштувань Джарвіса:", error);
    }
  };

  // Функція для збереження налаштувань Джарвіса
  const saveJarvisSettings = (settings: JarvisSettings) => {
    try {
      localStorage.setItem(JARVIS_SETTINGS_KEY, JSON.stringify(settings));
      setJarvisSettings(settings);
      console.log("Збережено налаштування Джарвіса:", settings);
    } catch (error) {
      console.error("Помилка при збереженні налаштувань Джарвіса:", error);
    }
  };

  // Функція для формування привітання
  const getGreeting = () => {
    const { greeting, userName, userTitle } = jarvisSettings;
    let fullGreeting = `${greeting}`;
    
    if (userName) {
      fullGreeting += `, ${userName}`;
    }
    
    if (userTitle && (!userName || userName.trim() === "")) {
      fullGreeting += `, ${userTitle}`;
    }
    
    return fullGreeting;
  };

  // Ініціалізація розпізнавання мови
  useEffect(() => {
    const SpeechRecognitionAPI = 
      window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (SpeechRecognitionAPI) {
      const recognition = new SpeechRecognitionAPI();
      recognition.lang = 'uk-UA'; // Українська мова за замовчуванням
      recognition.continuous = false; // Встановлюємо на false для одноразового розпізнавання
      recognition.interimResults = false;
      
      recognition.onresult = (event) => {
        // Отримуємо останній результат
        const result = event.results[event.results.length - 1];
        const transcript = result[0].transcript.toLowerCase().trim();
        
        // Виводимо розпізнаний текст для відлагодження
        console.log("Розпізнаний текст:", transcript);
        
        setRecognizedText(transcript);
        setIsListening(false);
        
        // Розпізнаємо ключове слово або команду
        const hasActivationWord = COMMANDS.ACTIVATE.some(cmd => transcript.includes(cmd));
        const hasTaskCommand = COMMANDS.READ_TASKS.some(cmd => transcript.includes(cmd));
        const hasEditCommand = COMMANDS.EDIT_TASK.some(cmd => transcript.includes(cmd));
        
        if (hasActivationWord || hasTaskCommand) {
          // Вимикаємо мікрофон після команди
          recognition.stop();
          
          // Відповідаємо користувачу з налаштованим привітанням
          const greeting = getGreeting();
          speakText(greeting);
          
          // Затримка перед виконанням команди мої задачі
          setTimeout(() => {
            handleTasksCommand();
          }, 2000);
        } else if (hasEditCommand) {
          // Вимикаємо мікрофон після команди
          if (recognitionRef.current) {
            recognitionRef.current.stop();
          }
          
          // Шукаємо час у команді (наприклад, "змінити задачу на 15:00")
          const timeMatch = transcript.match(/\d{1,2}:\d{2}/);
          if (timeMatch) {
            const timeToEdit = timeMatch[0];
            handleEditTaskCommand(timeToEdit);
          } else {
            speakText("Будь ласка, вкажіть час задачі, яку хочете редагувати. Наприклад: змінити задачу на 15:00");
          }
        } else if (COMMANDS.STOP.some(cmd => transcript.includes(cmd))) {
          // Команда зупинки
          stopSpeaking();
          speakText("Зупиняю озвучування");
        } else {
          // Якщо команда не розпізнана
          speakText("Вибачте, я не розумію цю команду. Скажіть 'Джарвіс' для перегляду задач або 'Редагувати' для зміни задачі.");
        }
      };
      
      recognition.onerror = (event) => {
        console.error('Помилка розпізнавання мови:', event.error);
        toast({
          title: "Помилка голосового помічника",
          description: "Сталася помилка розпізнавання.",
          variant: "destructive",
        });
        setIsListening(false);
      };
      
      recognition.onend = () => {
        console.log("Listening ended");
        setIsListening(false);
      };
      
      recognitionRef.current = recognition;
    } else {
      toast({
        title: "Не підтримується",
        description: "Ваш браузер не підтримує голосове розпізнавання",
        variant: "destructive",
      });
    }
    
    // Зупинка розпізнавання при виході
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      if (speechSynthesis && speechSynthesis.speaking) {
        speechSynthesis.cancel();
      }
    };
  }, []);
  
  // Ефект для створення анімації під час прослуховування або розмови
  useEffect(() => {
    let animationFrame: number;
    
    if (isListening || isSpeaking) {
      const animate = () => {
        const newWaveform = Array.from({length: 8}, () => 
          Math.floor(Math.random() * 40) + 10);
        setWaveform(newWaveform);
        animationFrame = requestAnimationFrame(animate);
      };
      
      animationFrame = requestAnimationFrame(animate);
    }
    
    return () => {
      cancelAnimationFrame(animationFrame);
      if (!isListening && !isSpeaking) {
        setWaveform([]);
      }
    };
  }, [isListening, isSpeaking]);
  
  // Функція для початку прослуховування
  const startListening = () => {
    if (recognitionRef.current) {
      try {
        // Оновлюємо стан
        setIsListening(true);
        setRecognizedText("");
        
        // Генеруємо випадкові висоти для анімації
        const heights = Array.from({ length: 10 }, () => 
          Math.floor(Math.random() * 60) + 20
        );
        setWaveform(heights);
        
        // Запускаємо розпізнавання
        recognitionRef.current.start();
        
        // Оновлюємо анімацію кожні 100мс
        const interval = setInterval(() => {
          const newHeights = Array.from({ length: 10 }, () => 
            Math.floor(Math.random() * 60) + 20
          );
          setWaveform(newHeights);
        }, 100);
        
        // Зупиняємо анімацію після 5 секунд, якщо немає результату
        setTimeout(() => {
          if (isListening) {
            clearInterval(interval);
            setIsListening(false);
            if (recognitionRef.current) {
              recognitionRef.current.stop();
            }
          }
        }, 5000);
        
        return () => clearInterval(interval);
      } catch (error) {
        console.error("Помилка при запуску розпізнавання:", error);
        setIsListening(false);
      }
    } else {
      console.error("Розпізнавання мови не підтримується");
    }
  };
  
  // Функція для синтезу мовлення через Google Cloud TTS
  const speakWithGoogleTTS = async (text: string) => {
    try {
      const settings = JSON.parse(localStorage.getItem(JARVIS_SETTINGS_KEY) || '{}');
      
      if (!settings.googleApiKey) {
        throw new Error('API ключ Google Cloud не налаштовано');
      }

      const response = await fetch('https://texttospeech.googleapis.com/v1/text:synthesize', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${settings.googleApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          input: { text },
          voice: {
            languageCode: 'uk-UA',
            name: 'uk-UA-Wavenet-A',
            ssmlGender: 'FEMALE'
          },
          audioConfig: {
            audioEncoding: 'MP3',
            pitch: 0,
            speakingRate: 0.9
          }
        })
      });

      if (!response.ok) {
        throw new Error('Помилка при зверненні до Google Cloud TTS');
      }

      const { audioContent } = await response.json();
      const audio = new Audio(`data:audio/mp3;base64,${audioContent}`);
      
      audio.onplay = () => setIsSpeaking(true);
      audio.onended = () => setIsSpeaking(false);
      audio.onerror = () => {
        setIsSpeaking(false);
        toast({
          title: "Помилка відтворення",
          description: "Не вдалося відтворити аудіо",
          variant: "destructive"
        });
      };

      await audio.play();

    } catch (error) {
      console.error('Помилка синтезу мовлення:', error);
      // Якщо сталася помилка з Google TTS, використовуємо браузерний синтез
      speakWithBrowserTTS(text);
    }
  };

  // Перейменовуємо стару функцію speakText на speakWithBrowserTTS
  const speakWithBrowserTTS = (text: string) => {
    if (!window.speechSynthesis) {
      console.error("Синтез мовлення не підтримується.");
      return;
    }
    
    if (speechSynthesis.speaking) {
      speechSynthesis.cancel();
    }
    
    console.log("Озвучую:", text);
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'uk-UA';
    utterance.rate = 0.9;
    utterance.pitch = 1.0;
    
    if (selectedVoice) {
      utterance.voice = selectedVoice;
    }
    
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    
    speechSynthesis.speak(utterance);
  };

  // Оновлена функція для озвучування тексту
  const speakText = async (text: string) => {
    const settings = JSON.parse(localStorage.getItem(JARVIS_SETTINGS_KEY) || '{}');
    
    if (settings.useGoogleTTS && settings.googleApiKey) {
      await speakWithGoogleTTS(text);
    } else {
      speakWithBrowserTTS(text);
    }
  };

  // Функція для отримання подій з Google Calendar
  const getGoogleCalendarEvents = async () => {
    try {
      const settings = JSON.parse(localStorage.getItem(JARVIS_SETTINGS_KEY) || '{}');
      
      if (!settings.googleApiKey) {
        return null;
      }

      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

      // Тут має бути ваш код для отримання подій з Google Calendar API
      // Це лише приклад структури даних
      const events = [
        {
          start: { dateTime: '2024-03-16T10:00:00' },
          summary: 'Зустріч з командою'
        },
        {
          start: { dateTime: '2024-03-16T14:30:00' },
          summary: 'Дзвінок із клієнтом'
        }
      ];

      return events;
    } catch (error) {
      console.error('Помилка отримання подій з календаря:', error);
      return null;
    }
  };

  // Оновлена функція обробки команди "задачі"
  const handleTasksCommand = async () => {
    try {
      const settings = JSON.parse(localStorage.getItem(JARVIS_SETTINGS_KEY) || '{}');
      const greeting = `${settings.greeting}${settings.userName ? ', ' + settings.userName : ''}${settings.userTitle ? ', ' + settings.userTitle : ''}. Я Джарвіс, ваш особистий асистент. Давайте подивимося на ваші задачі на сьогодні.`;
      
      await speakText(greeting);

      // Отримуємо всі задачі з localStorage
      const savedTasksJson = localStorage.getItem("tasks");
      let allTasks: Task[] = [];
      
      if (savedTasksJson) {
        try {
          const parsedTasks = JSON.parse(savedTasksJson);
          // Конвертуємо дати з рядків в об'єкти Date
          allTasks = parsedTasks.map((task: any) => ({
            ...task,
            date: new Date(task.date)
          }));
        } catch (error) {
          console.error("Помилка при зчитуванні задач:", error);
          allTasks = tasks; // Використовуємо задачі з пропсів як запасний варіант
        }
      } else {
        allTasks = tasks; // Якщо в localStorage нічого немає, використовуємо задачі з пропсів
      }

      // Отримуємо задачі на сьогодні
      const today = new Date();
      const todayTasks = allTasks.filter(task => 
        task.date.getDate() === today.getDate() &&
        task.date.getMonth() === today.getMonth() &&
        task.date.getFullYear() === today.getFullYear() &&
        !task.completed
      );

      if (todayTasks.length > 0) {
        let tasksText = `На сьогодні у вас ${todayTasks.length} ${todayTasks.length === 1 ? 'активна задача' : 
          todayTasks.length < 5 ? 'активні задачі' : 'активних задач'}. `;

        // Сортуємо задачі за часом
        todayTasks.sort((a, b) => a.date.getTime() - b.date.getTime());

        todayTasks.forEach(task => {
          const time = new Date(task.date);
          tasksText += `О ${formatTime(time)} ${task.title}${task.category ? `, категорія ${getCategoryLabel(task.category)}` : ''}. `;
        });

        tasksText += "Чим ще можу допомогти?";
        await speakText(tasksText);
      } else {
        const noTasksText = `На сьогодні у вас немає активних задач. Ви вільні, ${settings.userTitle || 'сер'}. Чим ще можу допомогти?`;
        await speakText(noTasksText);
      }
    } catch (error) {
      console.error("Помилка при обробці задач:", error);
      await speakText("Вибачте, виникла помилка при обробці ваших задач. Чим ще можу допомогти?");
    }
  };

  // Функція для отримання перекладу категорії
  const getCategoryLabel = (category: string): string => {
    const categoryTranslations: Record<string, string> = {
      "work": "Робота",
      "personal": "Особисте",
      "health": "Здоров'я",
      "education": "Навчання",
      "finance": "Фінанси"
    };
    return categoryTranslations[category] || category;
  };

  // Переривання мовлення
  const stopSpeaking = () => {
    if (speechSynthesis && speechSynthesis.speaking) {
      speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  };
  
  // Функція для отримання форматованого тексту місяця
  const getMonthName = (month: number): string => {
    const months = [
      'січень', 'лютий', 'березень', 'квітень', 'травень', 'червень', 
      'липень', 'серпень', 'вересень', 'жовтень', 'листопад', 'грудень'
    ];
    return months[month];
  };
  
  // Функція для групування задач по місяцях
  const groupTasksByMonth = (tasksList: Task[]) => {
    const grouped: { [key: string]: Task[] } = {};
    
    tasksList.forEach(task => {
      const taskDate = new Date(task.date);
      const monthKey = `${taskDate.getFullYear()}-${taskDate.getMonth()}`;
      
      if (!grouped[monthKey]) {
        grouped[monthKey] = [];
      }
      
      grouped[monthKey].push(task);
    });
    
    return grouped;
  };

  // Функція для редагування задачі
  const handleEditTaskCommand = async (timeToEdit: string) => {
    try {
      // Отримуємо всі задачі з localStorage
      const savedTasksJson = localStorage.getItem("tasks");
      let allTasks: Task[] = [];
      
      if (savedTasksJson) {
        const parsedTasks = JSON.parse(savedTasksJson);
        allTasks = parsedTasks.map((task: any) => ({
          ...task,
          date: new Date(task.date)
        }));
      } else {
        allTasks = tasks;
      }

      // Знаходимо задачу на вказаний час
      const today = new Date();
      const [hours, minutes] = timeToEdit.split(':').map(Number);
      
      const taskToEdit = allTasks.find(task => {
        const taskDate = new Date(task.date);
        return taskDate.getDate() === today.getDate() &&
               taskDate.getMonth() === today.getMonth() &&
               taskDate.getFullYear() === today.getFullYear() &&
               taskDate.getHours() === hours &&
               taskDate.getMinutes() === minutes;
      });

      if (taskToEdit) {
        await speakText(`Знайдено задачу на ${timeToEdit}: ${taskToEdit.title}. Що ви хочете змінити?`);
        // Тут можна додати логіку для зміни задачі через голосові команди
        // Наприклад, очікувати наступну команду з новим текстом задачі
      } else {
        await speakText(`Вибачте, я не знайшов задачу на ${timeToEdit}. Спробуйте вказати інший час.`);
      }
    } catch (error) {
      console.error("Помилка при редагуванні задачі:", error);
      await speakText("Вибачте, виникла помилка при редагуванні задачі.");
    }
  };

  // Компонент налаштувань Джарвіса
  const JarvisSettingsDialog = () => {
    const [settings, setSettings] = useState<JarvisSettings>({...jarvisSettings});
    
    const handleSave = () => {
      saveJarvisSettings(settings);
      setShowSettings(false);
      
      // Тестове привітання
      const greeting = `${settings.greeting}${settings.userName ? ', ' + settings.userName : ''}${settings.userTitle && !settings.userName ? ', ' + settings.userTitle : ''}`;
      speakText(`${greeting}. Налаштування збережено.`);
    };
    
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-card p-6 rounded-lg shadow-lg w-[400px] space-y-4">
          <h2 className="text-lg font-bold">Налаштування Джарвіса</h2>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Привітання</label>
              <input 
                type="text" 
                className="w-full p-2 border rounded-md"
                value={settings.greeting}
                onChange={(e) => setSettings({...settings, greeting: e.target.value})}
                placeholder="Да"
              />
              <p className="text-xs text-muted-foreground">Наприклад: Да, Слухаю, Так</p>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Ваше ім'я (опціонально)</label>
              <input 
                type="text" 
                className="w-full p-2 border rounded-md"
                value={settings.userName}
                onChange={(e) => setSettings({...settings, userName: e.target.value})}
                placeholder="Залиште порожнім, щоб не використовувати"
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Звертання</label>
              <input 
                type="text" 
                className="w-full p-2 border rounded-md"
                value={settings.userTitle}
                onChange={(e) => setSettings({...settings, userTitle: e.target.value})}
                placeholder="сер"
              />
              <p className="text-xs text-muted-foreground">Наприклад: шефе, бос, пане, мій повелитель</p>
            </div>
            
            <div className="pt-2">
              <p className="text-sm font-medium">Звучатиме як:</p>
              <p className="text-sm">"{`${settings.greeting}${settings.userName ? ', ' + settings.userName : ''}${settings.userTitle && !settings.userName ? ', ' + settings.userTitle : ''}`}. Перевіряю ваші задачі."</p>
            </div>
          </div>
          
          <div className="flex justify-end gap-2 pt-4">
            <button 
              className="px-4 py-2 border rounded-md"
              onClick={() => setShowSettings(false)}
            >
              Скасувати
            </button>
            <button 
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md"
              onClick={handleSave}
            >
              Зберегти
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed bottom-28 right-1 z-50 flex flex-col items-end gap-2">
      {/* Показуємо діалог налаштувань, якщо showSettings = true */}
      {showSettings && <JarvisSettingsDialog />}
      
      {/* Спливаюча підказка/статус */}
      {(isSpeaking || isListening) && (
        <div className="bg-card p-3 rounded-lg shadow-lg animate-fade-in flex items-center gap-2 max-w-sm">
          {/* Голосові хвилі */}
          <div className="flex items-center h-8 gap-[2px]">
            {waveform.map((height, index) => (
              <div 
                key={index}
                className={`w-[2px] ${isListening ? "bg-yellow-400" : "bg-blue-400"} animate-pulse-fast`}
                style={{ height: `${height}%` }}
              />
            ))}
          </div>
          
          <div className="flex flex-col">
            {isListening && <span className="text-xs font-bold text-yellow-400">Слухаю...</span>}
            {isSpeaking && <span className="text-xs text-blue-400">Озвучую задачі...</span>}
            {recognizedText && <span className="text-xs">{recognizedText}</span>}
          </div>
          
          {/* Кнопка вимкнення голосу */}
          {isSpeaking && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 rounded-full"
              onClick={stopSpeaking}
            >
              <VolumeX className="h-4 w-4" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
});

JarvisAssistant.displayName = "JarvisAssistant";

// Експортуємо додаткові властивості для використання в інших компонентах
export { type JarvisAssistantProps }; 