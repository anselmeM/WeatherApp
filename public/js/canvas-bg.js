// canvas-bg.js
// Highly optimized particle effects for rain, snow, clouds, and sun rays.

let canvas;
let ctx;
let animationFrameId;
let particles = [];
let weatherType = 'clear'; // default

class Particle {
  constructor(w, h, type) {
    this.w = w;
    this.h = h;
    this.type = type;
    this.reset();
  }

  reset() {
    this.x = Math.random() * this.w;
    
    if (this.type === 'rain') {
      this.y = Math.random() * -this.h;
      this.vy = Math.random() * 8 + 12;
      this.vx = Math.random() * 1 - 0.5;
      this.len = Math.random() * 15 + 15;
      this.opacity = Math.random() * 0.3 + 0.15;
    } else if (this.type === 'snow') {
      this.y = Math.random() * -this.h;
      this.vy = Math.random() * 1 + 0.8;
      this.vx = Math.random() * 1 - 0.5;
      this.r = Math.random() * 2.5 + 1;
      this.opacity = Math.random() * 0.4 + 0.2;
      this.swing = Math.random() * 0.02;
      this.swingAngle = Math.random() * Math.PI * 2;
    } else if (this.type === 'cloudy') {
      this.x = Math.random() * (this.w + 400) - 200;
      this.y = Math.random() * (this.h * 0.4);
      this.r = Math.random() * 80 + 70;
      this.vx = Math.random() * 0.15 + 0.05;
      this.opacity = Math.random() * 0.06 + 0.02;
    }
  }

  update() {
    if (this.type === 'rain') {
      this.y += this.vy;
      this.x += this.vx;
      if (this.y > this.h) this.reset();
    } else if (this.type === 'snow') {
      this.y += this.vy;
      this.swingAngle += this.swing;
      this.x += this.vx + Math.sin(this.swingAngle) * 0.3;
      if (this.y > this.h || this.x < 0 || this.x > this.w) this.reset();
    } else if (this.type === 'cloudy') {
      this.x += this.vx;
      if (this.x - this.r > this.w) {
        this.x = -this.r;
        this.y = Math.random() * (this.h * 0.4);
      }
    }
  }

  draw() {
    ctx.beginPath();
    if (this.type === 'rain') {
      ctx.strokeStyle = `rgba(156, 163, 175, ${this.opacity})`;
      ctx.lineWidth = 1.2;
      ctx.moveTo(this.x, this.y);
      ctx.lineTo(this.x + this.vx * 2, this.y + this.len);
      ctx.stroke();
    } else if (this.type === 'snow') {
      ctx.fillStyle = `rgba(255, 255, 255, ${this.opacity})`;
      ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
      ctx.fill();
    } else if (this.type === 'cloudy') {
      ctx.fillStyle = `rgba(255, 255, 255, ${this.opacity})`;
      // Draw a soft cloud blob using overlapping arcs
      ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(this.x + this.r * 0.5, this.y + 10, this.r * 0.8, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// Clear day radiant ray simulation
let rayAngle = 0;
function drawSunRays(w, h) {
  const isDark = document.documentElement.classList.contains('dark');
  if (isDark) return; // Only show sun rays on clear daylight views

  ctx.save();
  ctx.translate(w * 0.85, h * 0.15); // Origin near top right where sun is
  rayAngle += 0.0005;
  ctx.rotate(rayAngle);
  
  const numRays = 8;
  const maxRadius = Math.max(w, h) * 0.8;
  
  for (let i = 0; i < numRays; i++) {
    const angle = (i * Math.PI * 2) / numRays;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, maxRadius, angle - 0.15, angle + 0.15);
    ctx.closePath();
    
    const grad = ctx.createRadialGradient(0, 0, 50, 0, 0, maxRadius);
    grad.addColorStop(0, 'rgba(251, 191, 36, 0.05)');
    grad.addColorStop(1, 'rgba(251, 191, 36, 0)');
    ctx.fillStyle = grad;
    ctx.fill();
  }
  ctx.restore();
}

function resize() {
  if (!canvas) return;
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);
  setupParticles(rect.width, rect.height);
}

function setupParticles(w, h) {
  particles = [];
  let count = 0;
  if (weatherType === 'rain' || weatherType === 'storm') {
    count = 80;
  } else if (weatherType === 'snow') {
    count = 60;
  } else if (weatherType === 'cloudy') {
    count = 5;
  }
  
  for (let i = 0; i < count; i++) {
    particles.push(new Particle(w, h, weatherType));
  }
}

function animate() {
  if (!canvas || !ctx) return;
  const rect = canvas.getBoundingClientRect();
  ctx.clearRect(0, 0, rect.width, rect.height);

  if (weatherType === 'clear') {
    drawSunRays(rect.width, rect.height);
  } else {
    particles.forEach(p => {
      p.update();
      p.draw();
    });
  }

  animationFrameId = requestAnimationFrame(animate);
}

export function initCanvasBackground() {
  canvas = document.getElementById('weather-effect-canvas');
  if (!canvas) return;
  ctx = canvas.getContext('2d');
  
  window.addEventListener('resize', resize);
  resize();
  animate();
}

export function setWeatherEffect(condition) {
  const cond = condition.toLowerCase();
  let newType = 'clear';
  
  if (cond.includes('rain') || cond.includes('drizzle')) {
    newType = 'rain';
  } else if (cond.includes('storm')) {
    newType = 'storm'; // Uses rain particles
  } else if (cond.includes('snow') || cond.includes('sleet') || cond.includes('flurry')) {
    newType = 'snow';
  } else if (cond.includes('cloud') || cond.includes('overcast') || cond.includes('fog')) {
    newType = 'cloudy';
  }
  
  if (newType !== weatherType) {
    weatherType = newType;
    if (canvas) {
      const rect = canvas.getBoundingClientRect();
      setupParticles(rect.width, rect.height);
    }
  }
}
