const chalk = require('chalk');
const figlet = require('figlet');

// Konfigurasi font
const FONTS = {
  electronic: 'Electronic',
  big: 'Big',
  standard: 'Standard',
  slant: 'Slant',
  block: 'Block',
  bubble: 'Bubble',
  digital: 'Digital',
  larry3d: 'Larry3D',
};

// Warna-warna keren
const COLORS = {
  primary: '#00D4FF',    // Cyan terang
  secondary: '#7B2FBE',   // Ungu
  accent: '#FF6B6B',      // Merah
  success: '#00FF88',     // Hijau terang
  warning: '#FFD93D',     // Kuning
  info: '#4ECDC4',        // Teal
  facebook: '#1877F2',
  instagram: '#E4405F',
  twitter: '#1DA1F2',
  youtube: '#FF0000',
  tiktok: '#00F2EA',
  reddit: '#FF4500',
};

// Generate ASCII Art
async function generateAscii(text, font = 'Electronic', color = COLORS.primary) {
  return new Promise((resolve) => {
    figlet(text, { 
      font: font, 
      horizontalLayout: 'default',
      verticalLayout: 'default',
      width: 80,
      whitespaceBreak: true
    }, (err, data) => {
      if (err) {
        console.log('❌ Error generating figlet:', err);
        resolve(null);
      }
      resolve(data);
    });
  });
}

// Warna gradient untuk teks
function gradientText(text, colors = [COLORS.primary, COLORS.secondary]) {
  const chars = text.split('');
  const steps = colors.length - 1;
  const stepSize = Math.floor(chars.length / steps);
  
  let result = '';
  let colorIndex = 0;
  
  for (let i = 0; i < chars.length; i++) {
    if (i > 0 && i % stepSize === 0 && colorIndex < steps) {
      colorIndex++;
    }
    const color = colors[colorIndex] || colors[colors.length - 1];
    result += chalk.hex(color)(chars[i]);
  }
  
  return result;
}

// Tampilan Header dengan ASCII
async function displayBotHeader(botInfo) {
  console.clear();
  
  // Generate ASCII Art "EMBEDDED" dengan font Electronic
  const asciiArt = await generateAscii('EMBEDDED', 'Electronic', COLORS.primary);
  
  if (asciiArt) {
    // Tampilkan ASCII dengan warna gradient
    const lines = asciiArt.split('\n');
    for (const line of lines) {
      if (line.trim()) {
        console.log(gradientText(line, [COLORS.primary, COLORS.secondary, '#FF6B6B']));
      } else {
        console.log('');
      }
    }
  } else {
    // Fallback jika figlet gagal
    console.log(chalk.hex(COLORS.primary)('═══════════════════════════════════════════════════════'));
    console.log(chalk.hex(COLORS.primary).bold('                   EMBEDDED BOT                    '));
    console.log(chalk.hex(COLORS.primary)('═══════════════════════════════════════════════════════'));
  }
  
  console.log('');
  
  // Tampilkan info bot dengan style
  console.log(chalk.hex(COLORS.info)('┌─────────────────────────────────────────────────────────┐'));
  console.log(chalk.hex(COLORS.info)('│') + chalk.hex('#FFFFFF').bold(`  🤖 ${botInfo.name} v${botInfo.version}`) + ' '.repeat(40 - botInfo.name.length - 6) + chalk.hex(COLORS.info)('│'));
  console.log(chalk.hex(COLORS.info)('├─────────────────────────────────────────────────────────┤'));
  console.log(chalk.hex(COLORS.info)('│') + chalk.hex(COLORS.success)(`  ✅ Bot: ${botInfo.botTag}`) + ' '.repeat(39 - botInfo.botTag.length) + chalk.hex(COLORS.info)('│'));
  console.log(chalk.hex(COLORS.info)('│') + chalk.hex('#FFD93D')(`  📊 Servers: ${botInfo.guildCount}`) + ' '.repeat(36) + chalk.hex(COLORS.info)('│'));
  console.log(chalk.hex(COLORS.info)('│') + chalk.hex('#FF6B6B')(`  📡 Platforms: ${botInfo.platforms.join(', ')}`) + ' '.repeat(25) + chalk.hex(COLORS.info)('│'));
  console.log(chalk.hex(COLORS.info)('└─────────────────────────────────────────────────────────┘'));
  
  console.log('');
  
  // Tampilkan status dengan animasi
  console.log(chalk.hex(COLORS.success)('  ═══════════════════════════════════════════════════════'));
  console.log(chalk.hex(COLORS.success)('  ✅  BOT IS READY!  '));
  console.log(chalk.hex(COLORS.success)('  ═══════════════════════════════════════════════════════'));
  console.log('');
  
  // Tampilkan system info
  console.log(chalk.hex('#666666')(`  💻 Node: ${process.version}`));
  console.log(chalk.hex('#666666')(`  📦 Memory: ${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB`));
  console.log(chalk.hex('#666666')(`  🕐 Started: ${new Date().toLocaleString('id-ID')}`));
  console.log('');
}

// Tampilkan startup message
function displayStartMessage() {
  const spinner = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  let i = 0;
  
  return {
    start: (text) => {
      const interval = setInterval(() => {
        process.stdout.write(`\r${chalk.hex('#4ECDC4')(spinner[i])} ${chalk.white(text)}`);
        i = (i + 1) % spinner.length;
      }, 80);
      return interval;
    },
    stop: (interval, text) => {
      clearInterval(interval);
      process.stdout.write(`\r${chalk.hex('#00FF88')('✅')} ${chalk.white(text)}\n`);
    }
  };
}

// Tampilkan error dengan style
function displayError(error) {
  console.log('');
  console.log(chalk.hex('#FF0000')('  ╔═══════════════════════════════════════════════════════╗'));
  console.log(chalk.hex('#FF0000')('  ║ ') + chalk.hex('#FF0000').bold('❌ ERROR') + chalk.hex('#FF0000')('                                               ║'));
  console.log(chalk.hex('#FF0000')('  ╠═══════════════════════════════════════════════════════╣'));
  
  const message = error.message || String(error);
  const lines = message.match(/.{1,50}/g) || [message];
  for (const line of lines) {
    const padding = ' '.repeat(50 - line.length);
    console.log(chalk.hex('#FF0000')('  ║ ') + chalk.white(line) + padding + chalk.hex('#FF0000')('║'));
  }
  
  console.log(chalk.hex('#FF0000')('  ╚═══════════════════════════════════════════════════════╝'));
  console.log('');
}

// Tampilkan success message
function displaySuccess(message) {
  console.log(chalk.hex('#00FF88')('  ✅ ') + chalk.white(message));
}

// Tampilkan warning message
function displayWarning(message) {
  console.log(chalk.hex('#FFD93D')('  ⚠️ ') + chalk.white(message));
}

// Tampilkan info message
function displayInfo(message) {
  console.log(chalk.hex('#4ECDC4')('  ℹ️ ') + chalk.white(message));
}

// Tampilkan platform logo
function displayPlatformLogo(platform) {
  const logos = {
    'instagram': chalk.hex('#E4405F')('📸 Instagram'),
    'facebook': chalk.hex('#1877F2')('📘 Facebook'),
    'twitter': chalk.hex('#1DA1F2')('🐦 Twitter/X'),
    'youtube': chalk.hex('#FF0000')('▶️ YouTube'),
    'tiktok': chalk.hex('#00F2EA')('🎵 TikTok'),
    'reddit': chalk.hex('#FF4500')('🤖 Reddit'),
  };
  return logos[platform] || chalk.hex('#FFFFFF')('🔗 ' + platform);
}

// Tampilkan banner dengan platform yang didukung
function displayPlatformBanner(platforms) {
  console.log('');
  console.log(chalk.hex('#666666')('  Supported Platforms:'));
  console.log(chalk.hex('#666666')('  ────────────────────'));
  
  const cols = 3;
  let line = '  ';
  for (let i = 0; i < platforms.length; i++) {
    const logo = displayPlatformLogo(platforms[i]);
    line += logo + '  ';
    if ((i + 1) % cols === 0 && i < platforms.length - 1) {
      console.log(line);
      line = '  ';
    }
  }
  if (line.trim()) console.log(line);
  console.log('');
}

// Export semua fungsi
module.exports = {
  generateAscii,
  gradientText,
  displayBotHeader,
  displayStartMessage,
  displayError,
  displaySuccess,
  displayWarning,
  displayInfo,
  displayPlatformLogo,
  displayPlatformBanner,
  COLORS,
  FONTS,
};