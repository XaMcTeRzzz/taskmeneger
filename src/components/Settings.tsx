import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormField, FormItem, FormLabel, FormControl, FormDescription } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { toast } from "@/hooks/use-toast";
import { BotIcon, CheckIcon, SaveIcon, CalendarIcon, MailIcon, BellIcon, Moon, Sun, BellRing, Languages, Trash2, Mic, Clock, Send, AlertCircle, UploadCloud, FileKey } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TelegramSettings, loadTelegramSettings, saveTelegramSettings, validateBotToken, sendTestReport } from "@/lib/telegram-service";
import { initReportScheduler } from "@/lib/report-scheduler";

interface SettingsFormValues {
  telegramUsername: string;
  telegramBotEnabled: boolean;
  emailEnabled: boolean;
  emailAddress: string;
  googleCalendarEnabled: boolean;
  googleCalendarId: string;
  reminderEnabled: boolean;
  defaultReminderTime: string;
  welcomeMessage: string;
}

// Оновлюємо інтерфейс налаштувань Siri AI
interface SiriSettings {
  greeting: string;
  userName: string;
  userTitle: string;
  useGoogleTTS: boolean;
  googleApiKey: string;
  useCloudTTS: boolean; // Використовувати Google Cloud TTS API замість Web Speech API
  apiKeyFile: string; // Назва файлу з ключем API
  voiceLanguage: string;
  voiceName: string;
  voiceRate: number;
  voicePitch: number;
}

// Константа для ключа localStorage
const SIRI_SETTINGS_KEY = "siri_settings";
const GOOGLE_API_KEY_KEY = "google_tts_api_key"; // Ключ для зберігання API ключа

// Оновлюємо дефолтні налаштування
const DEFAULT_SIRI_SETTINGS: SiriSettings = {
  greeting: "Привіт",
  userName: "",
  userTitle: "",
  useGoogleTTS: false,
  googleApiKey: "",
  useCloudTTS: false,
  apiKeyFile: "",
  voiceLanguage: "uk-UA",
  voiceName: "",
  voiceRate: 1,
  voicePitch: 1,
};

export function Settings() {
  const [isSaving, setIsSaving] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light" | "system">("dark");
  const [notifications, setNotifications] = useState(true);
  const [language, setLanguage] = useState("uk");
  
  // Додаємо стан для налаштувань Siri AI
  const [siriSettings, setSiriSettings] = useState<SiriSettings>(DEFAULT_SIRI_SETTINGS);
  // Стан для відтворення тестового привітання
  const [isSpeaking, setIsSpeaking] = useState(false);
  // Стан для файлу API ключа
  const [apiKeyFilename, setApiKeyFilename] = useState<string>("");
  const [apiKeyContent, setApiKeyContent] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Додаємо стан для налаштувань Telegram
  const [telegramSettings, setTelegramSettings] = useState<TelegramSettings>(loadTelegramSettings());
  const [isTesting, setIsTesting] = useState(false);
  const [isValidatingToken, setIsValidatingToken] = useState(false);
  const [isTokenValid, setIsTokenValid] = useState<boolean | null>(null);
  
  // Initialize form with values from localStorage
  const form = useForm<SettingsFormValues>({
    defaultValues: {
      telegramUsername: "",
      telegramBotEnabled: false,
      emailEnabled: false,
      emailAddress: "",
      googleCalendarEnabled: false,
      googleCalendarId: "",
      reminderEnabled: true,
      defaultReminderTime: "30",
      welcomeMessage: "Вітаю! Я ваш бот-асистент для задач.",
    }
  });

  // Load settings from localStorage on component mount
  useEffect(() => {
    const savedSettings = localStorage.getItem("userSettings");
    if (savedSettings) {
      const parsedSettings = JSON.parse(savedSettings);
      form.reset(parsedSettings);
    }
    
    // Завантажуємо налаштування Siri AI
    loadSiriSettings();
    
    // Завантажуємо налаштування Telegram при ініціалізації
    const settings = loadTelegramSettings();
    setTelegramSettings(settings);
    
    // Ініціалізуємо планувальник звітів
    initReportScheduler();
  }, [form]);

  // Функція для завантаження ключа API з файлу
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    // Оновлюємо назву файлу
    setApiKeyFilename(file.name);
    
    // Читаємо вміст файлу
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        // Перевіряємо, чи це валідний JSON
        JSON.parse(content);
        
        // Зберігаємо вміст файлу
        setApiKeyContent(content);
        
        // Зберігаємо API ключ в localStorage
        localStorage.setItem(GOOGLE_API_KEY_KEY, content);
        
        // Оновлюємо налаштування
        handleSiriSettingsChange("apiKeyFile", file.name);
        handleSiriSettingsChange("useCloudTTS", true);
        
        toast({
          title: "API ключ завантажено",
          description: `Файл ${file.name} успішно завантажено`,
        });
      } catch (error) {
        console.error("Помилка при зчитуванні файлу API ключа:", error);
        toast({
          title: "Помилка завантаження",
          description: "Файл не є валідним JSON файлом ключа API",
          variant: "destructive",
        });
      }
    };
    reader.readAsText(file);
  };

  // Функція для видалення ключа API
  const handleRemoveApiKey = () => {
    localStorage.removeItem(GOOGLE_API_KEY_KEY);
    setApiKeyFilename("");
    setApiKeyContent("");
    
    // Оновлюємо налаштування
    handleSiriSettingsChange("apiKeyFile", "");
    handleSiriSettingsChange("useCloudTTS", false);
    
    // Очищаємо input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    
    toast({
      title: "API ключ видалено",
      description: "Ключ API успішно видалено",
    });
  };

  // Функція для завантаження налаштувань Siri AI
  const loadSiriSettings = () => {
    try {
      const savedSettings = localStorage.getItem(SIRI_SETTINGS_KEY);
      if (savedSettings) {
        const parsedSettings = JSON.parse(savedSettings) as SiriSettings;
        setSiriSettings(parsedSettings);
        
        // Якщо є збережений файл ключа, встановлюємо його назву
        if (parsedSettings.apiKeyFile) {
          setApiKeyFilename(parsedSettings.apiKeyFile);
          
          // Перевіряємо, чи є збережений ключ в localStorage
          const savedApiKey = localStorage.getItem(GOOGLE_API_KEY_KEY);
          if (savedApiKey) {
            setApiKeyContent(savedApiKey);
          }
        }
        
        console.log("Завантажено налаштування Siri AI:", parsedSettings);
      }
    } catch (error) {
      console.error("Помилка при завантаженні налаштувань Siri AI:", error);
    }
  };

  // Функція для тестування привітання
  const testGreeting = () => {
    let fullGreeting = siriSettings.greeting;
    if (siriSettings.userName) {
      fullGreeting += `, ${siriSettings.userName}`;
    }
    if (siriSettings.userTitle) {
      fullGreeting += `, ${siriSettings.userTitle}`;
    }
    fullGreeting += ". Це тестове привітання від Siri AI.";
    
    const utterance = new SpeechSynthesisUtterance(fullGreeting);
    utterance.lang = siriSettings.voiceLanguage;
    utterance.rate = siriSettings.voiceRate;
    utterance.pitch = siriSettings.voicePitch;
    
    if (siriSettings.voiceName) {
      const voices = speechSynthesis.getVoices();
      const selectedVoice = voices.find(voice => voice.name === siriSettings.voiceName);
      if (selectedVoice) {
        utterance.voice = selectedVoice;
      }
    }
    
    speechSynthesis.speak(utterance);
  };

  useEffect(() => {
    // При першому завантаженні перевіряємо збережену тему
    const savedTheme = localStorage.getItem("theme") as "dark" | "light" | "system" | null;
    if (savedTheme) {
      setTheme(savedTheme);
      applyTheme(savedTheme);
    }
  }, []);

  const applyTheme = (newTheme: "dark" | "light" | "system") => {
    const root = window.document.documentElement;
    
    if (newTheme === "system") {
      const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
      root.classList.toggle("dark", systemTheme === "dark");
    } else {
      root.classList.toggle("dark", newTheme === "dark");
    }
    
    localStorage.setItem("theme", newTheme);
  };

  const handleThemeChange = (newTheme: "dark" | "light" | "system") => {
    setTheme(newTheme);
    applyTheme(newTheme);
    
    toast({
      title: "Тема змінена",
      description: `Обрано ${
        newTheme === "dark" ? "темну" : newTheme === "light" ? "світлу" : "системну"
      } тему`,
    });
  };

  const handleClearData = () => {
    const confirmed = window.confirm("Ви впевнені, що хочете видалити всі задачі? Цю дію неможливо скасувати.");
    
    if (confirmed) {
      localStorage.removeItem("tasks");
      
      toast({
        title: "Всі дані видалено",
        description: "Всі задачі були успішно видалені",
      });
      
      // Перезавантажуємо сторінку для оновлення стану
      window.location.reload();
    }
  };

  // Save settings to localStorage
  const onSubmit = (values: SettingsFormValues) => {
    setIsSaving(true);
    // Simulate API call
    setTimeout(() => {
      localStorage.setItem("userSettings", JSON.stringify(values));
      setIsSaving(false);
      toast({
        title: "Налаштування збережено",
        description: "Ваші параметри були успішно збережені",
      });
    }, 800);
  };

  // Обробник зміни налаштувань Siri AI
  const handleSiriSettingsChange = (field: keyof SiriSettings, value: string | number | boolean) => {
    setSiriSettings(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Обробник зміни налаштувань Telegram
  const handleTelegramSettingChange = (field: keyof TelegramSettings, value: any) => {
    setTelegramSettings(prev => {
      const newSettings = { ...prev, [field]: value };
      saveTelegramSettings(newSettings);
      return newSettings;
    });
  };

  // Обробник зміни налаштувань розкладу
  const handleScheduleSettingChange = (field: keyof TelegramSettings['reportSchedule'], value: any) => {
    setTelegramSettings(prev => {
      const newSettings = { 
        ...prev, 
        reportSchedule: { 
          ...prev.reportSchedule, 
          [field]: value 
        } 
      };
      saveTelegramSettings(newSettings);
      return newSettings;
    });
  };

  // Перевірка валідності токена бота
  const handleValidateToken = async () => {
    if (!telegramSettings.botToken) {
      toast({
        title: "Помилка",
        description: "Введіть токен бота",
        variant: "destructive",
      });
      return;
    }

    setIsValidatingToken(true);
    setIsTokenValid(null);

    try {
      const isValid = await validateBotToken(telegramSettings.botToken);
      setIsTokenValid(isValid);

      if (isValid) {
        toast({
          title: "Токен валідний",
          description: "Токен бота успішно перевірено",
        });
      } else {
        toast({
          title: "Невалідний токен",
          description: "Перевірте правильність введеного токена",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Помилка перевірки токена:", error);
      setIsTokenValid(false);
      toast({
        title: "Помилка",
        description: "Не вдалося перевірити токен бота",
        variant: "destructive",
      });
    } finally {
      setIsValidatingToken(false);
    }
  };

  // Відправка тестового звіту
  const handleSendTestReport = async () => {
    setIsTesting(true);
    try {
      const result = await sendTestReport();
      toast({
        title: result.success ? "Успіх" : "Помилка",
        description: result.message,
        variant: result.success ? "default" : "destructive",
      });
    } catch (error) {
      console.error("Помилка при відправці тестового звіту:", error);
      toast({
        title: "Помилка",
        description: "Не вдалося відправити тестовий звіт",
        variant: "destructive",
      });
    } finally {
      setIsTesting(false);
    }
  };

  // Оновлюємо функцію renderSiriSettings, щоб додати функціонал завантаження API ключа
  const renderSiriSettings = () => (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center"><Mic className="mr-2" size={20} />Налаштування Siri AI</CardTitle>
        <CardDescription>Налаштуйте голосового асистента для вашого додатка</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-4">
          <div>
            <Label htmlFor="greeting">Привітання</Label>
            <Input 
              id="greeting" 
              placeholder="Привіт" 
              value={siriSettings.greeting}
              onChange={(e) => handleSiriSettingsChange("greeting", e.target.value)}
            />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="userName">Ім'я користувача</Label>
              <Input 
                id="userName" 
                placeholder="Іван" 
                value={siriSettings.userName}
                onChange={(e) => handleSiriSettingsChange("userName", e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="userTitle">Звертання</Label>
              <Input 
                id="userTitle" 
                placeholder="пане" 
                value={siriSettings.userTitle}
                onChange={(e) => handleSiriSettingsChange("userTitle", e.target.value)}
              />
            </div>
          </div>
          
          <Separator />
          
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="useGoogleTTS">Використовувати TTS</Label>
              <div className="text-sm text-muted-foreground">
                Увімкнути Google Text-to-Speech для озвучування
              </div>
            </div>
            <Switch 
              id="useGoogleTTS"
              checked={siriSettings.useGoogleTTS}
              onCheckedChange={(checked) => handleSiriSettingsChange("useGoogleTTS", checked)}
            />
          </div>
          
          <Separator />
          
          <div className="space-y-4">
            <div className="flex flex-col space-y-2">
              <Label>Google Cloud TTS API Key</Label>
              <div className="text-sm text-muted-foreground mb-2">
                Завантажте файл з ключем API для використання Google Cloud TTS API
              </div>
              
              <div className="flex items-center gap-2">
                <Input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  className="hidden"
                  onChange={handleFileUpload}
                  id="api-key-file"
                />
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center"
                >
                  <UploadCloud className="mr-2" size={16} />
                  Завантажити ключ API
                </Button>
                
                {apiKeyFilename && (
                  <div className="flex items-center">
                    <span className="text-sm text-muted-foreground mr-2">
                      <FileKey className="inline mr-1" size={16} />
                      {apiKeyFilename}
                    </span>
                    <Button 
                      size="sm"
                      variant="ghost" 
                      onClick={handleRemoveApiKey}
                      title="Видалити ключ"
                    >
                      <Trash2 size={16} />
                    </Button>
                  </div>
                )}
              </div>
              
              {apiKeyContent && (
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="useCloudTTS">Використовувати Cloud TTS API</Label>
                    <div className="text-sm text-muted-foreground">
                      Використовувати розширені можливості Google Cloud TTS
                    </div>
                  </div>
                  <Switch 
                    id="useCloudTTS"
                    checked={siriSettings.useCloudTTS}
                    onCheckedChange={(checked) => handleSiriSettingsChange("useCloudTTS", checked)}
                  />
                </div>
              )}
            </div>
          </div>
          
          <Separator />
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="voiceLanguage">Мова голосу</Label>
              <Select 
                value={siriSettings.voiceLanguage}
                onValueChange={(value) => handleSiriSettingsChange("voiceLanguage", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Оберіть мову" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="uk-UA">Українська</SelectItem>
                  <SelectItem value="en-US">Англійська (США)</SelectItem>
                  <SelectItem value="ru-RU">Російська</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="voiceRate">Швидкість</Label>
              <div className="flex items-center">
                <Input
                  id="voiceRate"
                  type="range"
                  min="0.5"
                  max="2"
                  step="0.1"
                  value={siriSettings.voiceRate}
                  onChange={(e) => handleSiriSettingsChange("voiceRate", parseFloat(e.target.value))}
                  className="flex-1"
                />
                <span className="ml-2 text-sm">{siriSettings.voiceRate}x</span>
              </div>
            </div>
          </div>
          
          <div>
            <Label htmlFor="voicePitch">Висота голосу</Label>
            <div className="flex items-center">
              <Input
                id="voicePitch"
                type="range"
                min="0.5"
                max="2"
                step="0.1"
                value={siriSettings.voicePitch}
                onChange={(e) => handleSiriSettingsChange("voicePitch", parseFloat(e.target.value))}
                className="flex-1"
              />
              <span className="ml-2 text-sm">{siriSettings.voicePitch}</span>
            </div>
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button 
          variant="outline" 
          onClick={testGreeting}
          disabled={isSpeaking}
        >
          <Mic className="mr-2" size={16} />
          Тестувати голос
        </Button>
        <Button 
          onClick={() => saveSiriSettings(siriSettings)}
          disabled={isSaving}
        >
          <SaveIcon className="mr-2" size={16} />
          Зберегти налаштування
        </Button>
      </CardFooter>
    </Card>
  );

  // Додаємо функцію для збереження налаштувань Siri AI
  const saveSiriSettings = (settings: SiriSettings) => {
    try {
      localStorage.setItem(SIRI_SETTINGS_KEY, JSON.stringify(settings));
      setSiriSettings(settings);
      console.log("Збережено налаштування Siri AI:", settings);
      toast({
        title: "Налаштування Siri AI збережено",
        description: "Ваші налаштування успішно збережено",
      });
    } catch (error) {
      console.error("Помилка при збереженні налаштувань Siri AI:", error);
      toast({
        title: "Помилка",
        description: "Не вдалося зберегти налаштування Siri AI",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="container mx-auto px-2 sm:px-4 py-4 sm:py-8 max-w-full sm:max-w-4xl">
      <div className="grid gap-4 sm:gap-6 grid-cols-1">
        {/* Загальні налаштування */}
        <Card className="w-full">
          <CardHeader className="space-y-1">
            <CardTitle className="text-lg sm:text-xl">Загальні налаштування</CardTitle>
            <CardDescription className="text-sm">Налаштування теми, мови та сповіщень</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 sm:space-y-4">
            <div className="flex flex-col space-y-3 sm:space-y-4">
              <div className="flex flex-col space-y-2">
                <Label>Тема</Label>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant={theme === "light" ? "default" : "outline"}
                    className="flex-1 min-w-[120px]"
                    onClick={() => setTheme("light")}
                  >
                    <Sun className="h-4 w-4 mr-2" />
                    Світла
                  </Button>
                  <Button
                    variant={theme === "dark" ? "default" : "outline"}
                    className="flex-1 min-w-[120px]"
                    onClick={() => setTheme("dark")}
                  >
                    <Moon className="h-4 w-4 mr-2" />
                    Темна
                  </Button>
                </div>
              </div>

              <div className="flex flex-col space-y-2">
                <Label>Мова</Label>
                <Select value={language} onValueChange={setLanguage}>
                  <SelectTrigger className="w-full">
                    <SelectValue>
                      <div className="flex items-center">
                        <Languages className="h-4 w-4 mr-2" />
                        {language === "uk" ? "Українська" : "English"}
                      </div>
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="uk">
                      <div className="flex items-center">
                        <Languages className="h-4 w-4 mr-2" />
                        Українська
                      </div>
                    </SelectItem>
                    <SelectItem value="en">
                      <div className="flex items-center">
                        <Languages className="h-4 w-4 mr-2" />
                        English
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Сповіщення</Label>
                  <div className="text-sm text-muted-foreground">
                    Отримувати сповіщення про нові задачі
                  </div>
                </div>
                <Switch
                  checked={notifications}
                  onCheckedChange={setNotifications}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Налаштування Telegram */}
        <Card className="w-full">
          <CardHeader className="space-y-1">
            <CardTitle className="text-lg sm:text-xl">Налаштування Telegram</CardTitle>
            <CardDescription className="text-sm">Налаштування Telegram бота для отримання звітів</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 sm:space-y-4">
            <div className="flex flex-col space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Активувати бота</Label>
                  <div className="text-sm text-muted-foreground">
                    Увімкнути відправку звітів через Telegram
                  </div>
                </div>
                <Switch
                  checked={telegramSettings.enabled}
                  onCheckedChange={(checked) => {
                    setTelegramSettings({ ...telegramSettings, enabled: checked });
                  }}
                />
              </div>

              <div className="space-y-2">
                <Label>Токен бота</Label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="flex-1">
                    <Input
                      type="password"
                      placeholder="Введіть токен бота"
                      value={telegramSettings.botToken || ""}
                      onChange={(e) => {
                        setTelegramSettings({
                          ...telegramSettings,
                          botToken: e.target.value,
                        });
                      }}
                    />
                  </div>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleValidateToken}
                    disabled={isValidatingToken || !telegramSettings.botToken}
                    className="shrink-0"
                  >
                    {isValidatingToken ? (
                      <AlertCircle className="h-4 w-4 animate-spin" />
                    ) : isTokenValid === true ? (
                      <CheckIcon className="h-4 w-4 text-green-500" />
                    ) : (
                      <BotIcon className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label>ID чату</Label>
                <Input
                  type="text"
                  placeholder="Введіть ID чату"
                  value={telegramSettings.chatId || ""}
                  onChange={(e) => {
                    setTelegramSettings({
                      ...telegramSettings,
                      chatId: e.target.value,
                    });
                  }}
                />
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <Button
                  variant="outline"
                  onClick={handleSendTestReport}
                  disabled={isTesting || !telegramSettings.enabled || !telegramSettings.botToken || !telegramSettings.chatId}
                  className="w-full sm:flex-1"
                >
                  {isTesting ? (
                    <AlertCircle className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Send className="h-4 w-4 mr-2" />
                  )}
                  Надіслати тест
                </Button>
                
                <Button
                  variant="outline"
                  onClick={() => {
                    saveTelegramSettings(telegramSettings);
                    toast({
                      title: "Налаштування збережено",
                      description: "Налаштування Telegram успішно оновлено",
                    });
                  }}
                  className="w-full sm:flex-1"
                >
                  <SaveIcon className="h-4 w-4 mr-2" />
                  Зберегти
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Telegram Bot Settings */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BotIcon className="h-5 w-5" />
              Telegram Bot
            </CardTitle>
            <CardDescription>Налаштування бота для відправки звітів</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Увімкнути Telegram бота</Label>
                <p className="text-xs text-muted-foreground">Отримуйте звіти про задачі через Telegram</p>
              </div>
              <Switch 
                checked={telegramSettings.enabled} 
                onCheckedChange={(checked) => handleTelegramSettingChange('enabled', checked)}
              />
            </div>

            {telegramSettings.enabled && (
              <>
                <Separator className="my-2" />
                
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="bot-token">Токен бота</Label>
                    <div className="flex gap-2">
                      <Input
                        id="bot-token"
                        type="password"
                        value={telegramSettings.botToken}
                        onChange={(e) => handleTelegramSettingChange('botToken', e.target.value)}
                        placeholder="123456789:ABCDEFGHIJKLMNOPQRSTUVWXYZ"
                        className="flex-1"
                      />
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={handleValidateToken}
                        disabled={isValidatingToken || !telegramSettings.botToken}
                      >
                        {isValidatingToken ? "Перевірка..." : "Перевірити"}
                      </Button>
                    </div>
                    {isTokenValid !== null && (
                      <p className={`text-xs ${isTokenValid ? "text-green-500" : "text-red-500"}`}>
                        {isTokenValid ? "✓ Токен валідний" : "✗ Токен невалідний"}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Створіть бота через @BotFather в Telegram і отримайте токен
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="chat-id">ID чату</Label>
                    <Input
                      id="chat-id"
                      value={telegramSettings.chatId}
                      onChange={(e) => handleTelegramSettingChange('chatId', e.target.value)}
                      placeholder="123456789"
                    />
                    <p className="text-xs text-muted-foreground">
                      Ваш особистий ID в Telegram або ID групового чату
                    </p>
                  </div>

                  <Separator className="my-2" />

                  <div className="space-y-2">
                    <Label>Розклад звітів</Label>
                    
                    <div className="space-y-4 pt-2">
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <span className="text-sm font-medium">Щоденний звіт</span>
                          <p className="text-xs text-muted-foreground">Отримуйте звіт про задачі щодня</p>
                        </div>
                        <Switch 
                          checked={telegramSettings.reportSchedule.daily} 
                          onCheckedChange={(checked) => handleScheduleSettingChange('daily', checked)}
                        />
                      </div>

                      {telegramSettings.reportSchedule.daily && (
                        <div className="ml-6 space-y-2">
                          <Label htmlFor="daily-time">Час відправки</Label>
                          <Input
                            id="daily-time"
                            type="time"
                            value={telegramSettings.reportSchedule.dailyTime}
                            onChange={(e) => handleScheduleSettingChange('dailyTime', e.target.value)}
                          />
                        </div>
                      )}

                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <span className="text-sm font-medium">Щотижневий звіт</span>
                          <p className="text-xs text-muted-foreground">Отримуйте підсумковий звіт за тиждень</p>
                        </div>
                        <Switch 
                          checked={telegramSettings.reportSchedule.weekly} 
                          onCheckedChange={(checked) => handleScheduleSettingChange('weekly', checked)}
                        />
                      </div>

                      {telegramSettings.reportSchedule.weekly && (
                        <div className="ml-6 space-y-4">
                          <div className="space-y-2">
                            <Label htmlFor="weekly-day">День тижня</Label>
                            <Select 
                              value={telegramSettings.reportSchedule.weeklyDay.toString()} 
                              onValueChange={(value) => handleScheduleSettingChange('weeklyDay', parseInt(value))}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Оберіть день" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="1">Понеділок</SelectItem>
                                <SelectItem value="2">Вівторок</SelectItem>
                                <SelectItem value="3">Середа</SelectItem>
                                <SelectItem value="4">Четвер</SelectItem>
                                <SelectItem value="5">П'ятниця</SelectItem>
                                <SelectItem value="6">Субота</SelectItem>
                                <SelectItem value="0">Неділя</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="weekly-time">Час відправки</Label>
                            <Input
                              id="weekly-time"
                              type="time"
                              value={telegramSettings.reportSchedule.weeklyTime}
                              onChange={(e) => handleScheduleSettingChange('weeklyTime', e.target.value)}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Telegram Integration */}
            <div className="glass-card p-4 rounded-xl space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <h3 className="text-base font-medium">Telegram інтеграція</h3>
                  <p className="text-sm text-muted-foreground">Отримуйте сповіщення через Telegram</p>
                </div>
                <FormField
                  control={form.control}
                  name="telegramBotEnabled"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Switch 
                          checked={field.value} 
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>

              {form.watch("telegramBotEnabled") && (
                <div className="space-y-4 pt-2 border-t border-border/50">
                  <FormField
                    control={form.control}
                    name="telegramUsername"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Ваш Telegram username</FormLabel>
                        <FormControl>
                          <div className="flex items-center space-x-2">
                            <span className="text-muted-foreground">@</span>
                            <Input placeholder="username" {...field} />
                          </div>
                        </FormControl>
                        <FormDescription>
                          Введіть ваш username без символу @
                        </FormDescription>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="welcomeMessage"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Привітальне повідомлення</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Введіть текст, який бот надішле вам після з'єднання" 
                            className="resize-none" 
                            {...field} 
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
              )}
            </div>

            {/* Email Integration */}
            <div className="glass-card p-4 rounded-xl space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <h3 className="text-base font-medium">Email сповіщення</h3>
                  <p className="text-sm text-muted-foreground">Отримуйте нагадування на пошту</p>
                </div>
                <FormField
                  control={form.control}
                  name="emailEnabled"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Switch 
                          checked={field.value} 
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>

              {form.watch("emailEnabled") && (
                <div className="space-y-4 pt-2 border-t border-border/50">
                  <FormField
                    control={form.control}
                    name="emailAddress"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email адреса</FormLabel>
                        <FormControl>
                          <Input 
                            type="email" 
                            placeholder="your@email.com" 
                            {...field} 
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
              )}
            </div>

            {/* Google Calendar Integration */}
            <div className="glass-card p-4 rounded-xl space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <h3 className="text-base font-medium">Google Calendar</h3>
                  <p className="text-sm text-muted-foreground">Синхронізуйте задачі з Google Calendar</p>
                </div>
                <FormField
                  control={form.control}
                  name="googleCalendarEnabled"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Switch 
                          checked={field.value} 
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>

              {form.watch("googleCalendarEnabled") && (
                <div className="space-y-4 pt-2 border-t border-border/50">
                  <FormField
                    control={form.control}
                    name="googleCalendarId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>ID Google Calendar</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="calendar_id@group.calendar.google.com" 
                            {...field} 
                          />
                        </FormControl>
                        <FormDescription>
                          Знайдіть ID календаря в налаштуваннях Google Calendar
                        </FormDescription>
                      </FormItem>
                    )}
                  />
                  <Button variant="outline" className="w-full" type="button">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    Підключити Google Calendar
                  </Button>
                </div>
              )}
            </div>

            {/* Reminders */}
            <div className="glass-card p-4 rounded-xl space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <h3 className="text-base font-medium">Нагадування</h3>
                  <p className="text-sm text-muted-foreground">Налаштування сповіщень про задачі</p>
                </div>
                <FormField
                  control={form.control}
                  name="reminderEnabled"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Switch 
                          checked={field.value} 
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>

              {form.watch("reminderEnabled") && (
                <div className="space-y-4 pt-2 border-t border-border/50">
                  <FormField
                    control={form.control}
                    name="defaultReminderTime"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Час нагадування за замовчуванням</FormLabel>
                        <FormControl>
                          <Input type="time" {...field} />
                        </FormControl>
                        <FormDescription>
                          Час, коли ви бажаєте отримувати нагадування
                        </FormDescription>
                      </FormItem>
                    )}
                  />
                </div>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={isSaving}>
              {isSaving ? (
                <>
                  <SaveIcon className="mr-2 h-4 w-4 animate-spin" />
                  Зберігаємо...
                </>
              ) : (
                <>
                  <SaveIcon className="mr-2 h-4 w-4" />
                  Зберегти налаштування
                </>
              )}
            </Button>
          </form>
        </Form>

        {/* Налаштування Siri */}
        <Card className="w-full">
          <CardHeader className="space-y-1">
            <CardTitle className="text-lg sm:text-xl">Налаштування Siri</CardTitle>
            <CardDescription className="text-sm">Налаштування голосового асистента</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 sm:space-y-4">
            <div className="flex flex-col space-y-4">
              <div className="space-y-2">
                <Label>Привітання</Label>
                <Input
                  placeholder="Введіть текст привітання"
                  value={siriSettings.greeting}
                  onChange={(e) =>
                    setSiriSettings({ ...siriSettings, greeting: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>Ім'я користувача</Label>
                <Input
                  placeholder="Введіть ваше ім'я"
                  value={siriSettings.userName}
                  onChange={(e) =>
                    setSiriSettings({ ...siriSettings, userName: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>Звертання</Label>
                <Input
                  placeholder="Як до вас звертатися"
                  value={siriSettings.userTitle}
                  onChange={(e) =>
                    setSiriSettings({ ...siriSettings, userTitle: e.target.value })
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Google Cloud TTS</Label>
                  <div className="text-sm text-muted-foreground">
                    Використовувати Google Cloud Text-to-Speech
                  </div>
                </div>
                <Switch
                  checked={siriSettings.useCloudTTS}
                  onCheckedChange={(checked) =>
                    setSiriSettings({ ...siriSettings, useCloudTTS: checked })
                  }
                />
              </div>

              {siriSettings.useCloudTTS && (
                <div className="space-y-2">
                  <Label>API ключ</Label>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <div className="flex-1">
                      <Input
                        type="file"
                        accept=".json"
                        ref={fileInputRef}
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                      <div className="flex flex-col sm:flex-row gap-2">
                        <Input
                          readOnly
                          value={apiKeyFilename || "Файл не обрано"}
                          className="flex-1"
                        />
                        <Button
                          variant="outline"
                          onClick={() => fileInputRef.current?.click()}
                          className="shrink-0"
                        >
                          <UploadCloud className="h-4 w-4 mr-2" />
                          Обрати файл
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-2">
                <Button
                  variant="outline"
                  onClick={testGreeting}
                  disabled={isSpeaking}
                  className="w-full sm:flex-1"
                >
                  <Mic className="h-4 w-4 mr-2" />
                  Тест привітання
                </Button>
                
                <Button
                  variant="outline"
                  onClick={() => {
                    localStorage.setItem(SIRI_SETTINGS_KEY, JSON.stringify(siriSettings));
                    toast({
                      title: "Налаштування збережено",
                      description: "Налаштування Siri успішно оновлено",
                    });
                  }}
                  className="w-full sm:flex-1"
                >
                  <SaveIcon className="h-4 w-4 mr-2" />
                  Зберегти
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Налаштування сповіщень */}
        <Card className="w-full">
          <CardHeader className="space-y-1">
            <CardTitle className="text-lg sm:text-xl">Налаштування сповіщень</CardTitle>
            <CardDescription className="text-sm">Налаштування часу та типу сповіщень</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 sm:space-y-4">
            <Form {...form}>
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="reminderEnabled"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <FormLabel>Нагадування</FormLabel>
                        <FormDescription>
                          Отримувати нагадування про задачі
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="defaultReminderTime"
                  render={({ field }) => (
                    <FormItem className="space-y-2">
                      <FormLabel>Час нагадування</FormLabel>
                      <FormDescription>
                        За скільки хвилин нагадувати про задачу
                      </FormDescription>
                      <FormControl>
                        <Input
                          type="number"
                          {...field}
                          min="1"
                          max="1440"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <div className="flex flex-col sm:flex-row gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      // Зберігаємо налаштування
                      const values = form.getValues();
                      localStorage.setItem('notification_settings', JSON.stringify(values));
                      toast({
                        title: "Налаштування збережено",
                        description: "Налаштування сповіщень успішно оновлено",
                      });
                    }}
                    className="w-full sm:flex-1"
                  >
                    <SaveIcon className="h-4 w-4 mr-2" />
                    Зберегти
                  </Button>
                </div>
              </div>
            </Form>
          </CardContent>
        </Card>

        {/* Видалення даних */}
        <Card className="w-full border-destructive/50">
          <CardHeader className="space-y-1">
            <CardTitle className="text-lg sm:text-xl text-destructive">Видалення даних</CardTitle>
            <CardDescription className="text-sm">Очищення даних додатку</CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="destructive"
              onClick={handleClearData}
              className="w-full sm:w-auto"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Видалити всі задачі
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
