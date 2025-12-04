require("dotenv").config();
const express = require("express");
const TelegramBot = require("node-telegram-bot-api");
const path = require("path");

const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;
const OPENWEATHER_API_KEY = process.env.OPENWEATHER_API_KEY; 

const bot = new TelegramBot(BOT_TOKEN, { polling: false });

function buildMessage(baseText) {
  return `${baseText}\n\n✅ <a href="https://t.me/huyova_bila_tserkva">Хуйова Біла Церква</a> | <a href="https://t.me/xy_bts">Прислати новину</a>`;
}

async function sendDailyWeather() {
  try {
    const res = await fetch(`https://api.openweathermap.org/data/2.5/weather?q=Bila+Tserkva,UA&appid=${OPENWEATHER_API_KEY}&units=metric&lang=uk`);
    const data = await res.json();

    if (!data || data.cod !== 200) {
      throw new Error(data.message || "Не вдалося отримати дані погоди");
    }

    const temp = data.main.temp.toFixed(1);
    const feelsLike = data.main.feels_like.toFixed(1);
    const description = data.weather[0].description;
    const humidity = data.main.humidity;
    const windSpeed = data.wind.speed.toFixed(1);

    const descLower = description.toLowerCase();

    const text = `🌤 <b>Погода у Білій Церкві на сьогодні</b>\n\n` +
                 `🌡 Температура: ${temp}°C (відчувається як ${feelsLike}°C)\n` +
                 `💧 Вологість: ${humidity}%\n` +
                 `💨 Вітер: ${windSpeed} м/с\n` +
                 `🌈 Стан: ${description}\n\n` +
                 `☕ Рекомендація: ${getWeatherAdvice(descLower, temp)}`;

    // Локальна картинка
    const imagePath = path.join(__dirname, "images", "va.jpg");

    await bot.sendPhoto(CHAT_ID, imagePath, { caption: buildMessage(text), parse_mode: "HTML" });
    console.log("Погода відправлена з локальною картинкою ✅");
  } catch (err) {
    console.error("Помилка при отриманні погоди:", err.message);
  }
}

function getWeatherAdvice(desc, temp) {
  if (desc.includes("дощ")) return "Візьми парасольку ☔ та насолоджуйся кавою вдома!";
  if (desc.includes("гроза")) return "Будь обережний! ⚡ Краще залишитись вдома.";
  if (desc.includes("сніг")) return "Чудовий день для снігових прогулянок ❄️";
  if (desc.includes("туман")) return "Будь обережний на дорозі 🌫";
  if (parseFloat(temp) < 5) return "Тепло одягайся 🧥, холодно!";
  if (parseFloat(temp) > 25) return "Легкий одяг 👕 та пий багато води 💦";
  return "Чудовий день, насолоджуйся 🌤";
}

// ==== Щоденний відправка о 07:45
let lastSentDate = null;

setInterval(() => {
  const now = new Date();
  const kyivTime = new Date(now.toLocaleString("en-US", { timeZone: "Europe/Kiev" }));
  const hours = kyivTime.getHours();
  const minutes = kyivTime.getMinutes();
  const today = kyivTime.toISOString().split("T")[0];

  if (hours === 07 && minutes === 45 && lastSentDate !== today) {
    console.log("⏰ 07:45 — відправляємо погоду");
    lastSentDate = today;
    sendDailyWeather();
  } else if (hours > 07 && minutes > 45 && lastSentDate !== today) {
    console.log("⏰ Прокинулись пізніше → відправляємо погоду");
    lastSentDate = today;
    sendDailyWeather();
  }
}, 60 * 1000);

const app = express();
app.get("/", (req, res) => {
  res.send("Бот працює 🚀");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Сервер запущено на порту ${PORT}`));
