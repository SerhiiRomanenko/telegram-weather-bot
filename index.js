import 'dotenv/config';
import express from 'express';
import TelegramBot from 'node-telegram-bot-api';
import { createCanvas, loadImage } from 'canvas';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;
const OWM_API_KEY = process.env.OWM_API_KEY;
const CITY = process.env.CITY || "Odessa,UA";

const bot = new TelegramBot(BOT_TOKEN, { polling: false });

/* ================= HELPERS ================= */

function getTomorrowFormattedUA() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow.toLocaleDateString('uk-UA');
}

function getWeatherAdvice(desc, temp) {
  if (desc.includes("дощ")) return "Візьми парасольку ☔ та насолоджуйся кавою вдома!";
  if (desc.includes("гроза")) return "Будь обережний! ⚡ Краще залишитись вдома.";
  if (desc.includes("сніг")) return "Чудовий день для снігових прогулянок ❄️";
  if (desc.includes("туман")) return "Будь обережний на дорозі 🌫";
  if (parseFloat(temp) < 5) return "Тепло одягайся 🧥!";
  if (parseFloat(temp) > 25) return "Легкий одяг 👕 та пий багато води 💦";
  return "Чудовий день, насолоджуйся 🌤";
}

/* ================= API LOGIC ================= */

async function getForecastFromAPI() {
  const url = `https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(CITY)}&units=metric&lang=uk&appid=${OWM_API_KEY}`;
  const res = await fetch(url);
  const data = await res.json();

  if (!data.list) throw new Error('Погода десь про*балася (немає даних)');

  const now = new Date();
  const nightStart = new Date(now).setHours(20, 0, 0, 0);
  const nightEnd = new Date(now.getTime() + 24 * 60 * 60 * 1000).setHours(8, 0, 0, 0);
  const dayStart = new Date(now.getTime() + 24 * 60 * 60 * 1000).setHours(8, 0, 0, 0);
  const dayEnd = new Date(now.getTime() + 24 * 60 * 60 * 1000).setHours(20, 0, 0, 0);

  const nightPoints = data.list.filter(item => (item.dt * 1000) >= nightStart && (item.dt * 1000) <= nightEnd);
  const dayPoints = data.list.filter(item => (item.dt * 1000) >= dayStart && (item.dt * 1000) <= dayEnd);

  const getStats = (points, type) => {
    if (points.length === 0) return { temp: 0, desc: 'хз шо там', icon: '01d', humidity: 0, wind: 0 };
    
    let target = points[0];
    points.forEach(p => {
      if (type === 'min' && p.main.temp < target.main.temp) target = p;
      if (type === 'max' && p.main.temp > target.main.temp) target = p;
    });

    const rainPoint = points.find(p => p.weather[0].main === 'Rain' || p.weather[0].main === 'Snow');
    const finalDisplay = rainPoint || target;

    return {
      temp: Math.round(target.main.temp),
      desc: finalDisplay.weather[0].description,
      icon: finalDisplay.weather[0].icon,
      humidity: finalDisplay.main.humidity,
      wind: finalDisplay.wind.speed
    };
  };

  return {
    night: getStats(nightPoints, 'min'),
    day: getStats(dayPoints, 'max')
  };
}

/* ================= CANVAS GENERATOR ================= */

async function createWeatherImage(forecast) {
  const WIDTH = 609;
  const HEIGHT = 340;
  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext('2d');

  const phrases = ['ЄБАТЬ', 'ТА НУ НАХУЙ', 'ЗАЄБІСЬ', 'НУ ПІЗДЄЦ', 'ЦЕ ПИЗДА', 'Я В АХУЇ', 'ХУЯК'];
  const randomText = phrases[Math.floor(Math.random() * phrases.length)];

  const faceIndex = Math.floor(Math.random() * 6) + 1;
  const personPath = path.join(__dirname, 'icons', 'faces', `face_${faceIndex}.png`);

  const [iconNight, iconDay, personImg] = await Promise.all([
    loadImage(`https://openweathermap.org/img/wn/${forecast.night.icon}@4x.png`),
    loadImage(`https://openweathermap.org/img/wn/${forecast.day.icon}@4x.png`),
    loadImage(personPath)
  ]);

  const grad = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  grad.addColorStop(0, '#2b5f8a');
  grad.addColorStop(1, '#2b5f8a');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  ctx.fillStyle = 'white';
  ctx.textAlign = 'center';
  ctx.font = '22px Arial';
  ctx.fillText(`Погода в Білій Церкві на завтра ${getTomorrowFormattedUA()}`, WIDTH / 2, 35);

  ctx.strokeStyle = 'rgba(255,255,255,0.3)';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(WIDTH / 2, 70); ctx.lineTo(WIDTH / 2, 220); ctx.stroke();

const drawBlock = (title, icon, temp, desc, centerX, offsetX = 0) => {
  const baseY = 135;        // спільна лінія для іконки + температури
  const iconSize = 180;     // розмір іконки

  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.font = 'bold 22px Arial';
  ctx.textAlign = 'center';
  ctx.fillText(title, centerX + offsetX, 75);

  // ІКОНКА (вирівняна по центру температури)
  ctx.drawImage(
    icon,
    centerX - 150 + offsetX,
    baseY - iconSize / 2,
    iconSize,
    iconSize
  );

  // ТЕМПЕРАТУРА
  ctx.fillStyle = 'white';
  ctx.font = 'bold 75px Arial';
  ctx.textAlign = 'left';
  ctx.fillText(`${temp}°`, centerX + 5 + offsetX, baseY + 25);

  // ОПИС
  ctx.font = 'bold 24px Arial';
  ctx.textAlign = 'center';
  ctx.fillText(
    desc.charAt(0).toUpperCase() + desc.slice(1),
    centerX + offsetX,
    216   // позиція під температурою до опису 
  );
};


 drawBlock('НІЧ', iconNight, forecast.night.temp, forecast.night.desc, WIDTH * 0.25, -40);
drawBlock('ДЕНЬ', iconDay, forecast.day.temp, forecast.day.desc, WIDTH * 0.75, 40);

  const scale = (HEIGHT * 0.7) / personImg.height;
  const pW = personImg.width * scale;
  const pH = personImg.height * scale;
  ctx.drawImage(personImg, WIDTH / 2 - pW / 2, HEIGHT - pH + 15, pW, pH);

  ctx.font = 'bold 66px Arial'; 
  ctx.textAlign = 'center';
  ctx.strokeStyle = 'black';
  ctx.lineWidth = 12;
  ctx.strokeText(randomText, WIDTH / 2, HEIGHT - 15);
  ctx.fillStyle = 'white';
  ctx.fillText(randomText, WIDTH / 2, HEIGHT - 15);

  const filePath = path.join(__dirname, 'weather_temp.png');
  fs.writeFileSync(filePath, canvas.toBuffer('image/png'));
  return filePath;
}

/* ================= TELEGRAM LOGIC ================= */

async function sendDailyWeather() {
  try {
    const forecast = await getForecastFromAPI();
    const imagePath = await createWeatherImage(forecast);

    const advice = getWeatherAdvice(forecast.day.desc, forecast.day.temp);

    const caption = `🌤 <b>Погода у Білій Церкві на завтра (${getTomorrowFormattedUA()})</b>\n\n` +
      
      `💧 Вологість: <b>${forecast.day.humidity}%</b>\n` +
      `💨 Вітер: <b>${forecast.day.wind} м/с</b>\n\n` +
      `⚓ <b>Порада від хуадміна:</b> ${advice}\n\n` +
      `<a href="https://t.me/huyova_bila_tserkva">✅ Хуйова Біла Церква</a> | <a href="https://t.me/xy_dmin">Прислати новину</a>`;

    await bot.sendPhoto(CHAT_ID, imagePath, { caption, parse_mode: "HTML" });
    console.log("✅ Погода в БЦ відправлена!");

    if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
  } catch (err) {
    console.error("❌ Помилка бота:", err);
  }
}

/* ================= SCHEDULER & SERVER ================= */

let lastSentDate = null;

setInterval(() => {
  const now = new Date();
  const kyivTime = new Date(now.toLocaleString("en-US", { timeZone: "Europe/Kiev" }));
  const hours = kyivTime.getHours();
  const minutes = kyivTime.getMinutes();
  const today = kyivTime.toISOString().split("T")[0];

  // Відправляємо об 18:30 як у вашому прикладі
  // if (hours === 13 && minutes === 25 && lastSentDate !== today) {
    lastSentDate = today;
    sendDailyWeather();
  // }
}, 5 * 1000);  // 5 => 60 для реального використання

const app = express();
app.get("/", (req, res) => res.send("Бот Погоди працює 🚀"));
app.listen(process.env.PORT || 3000, () => console.log(`Сервер запущено на порту ${process.env.PORT || 3000}`));