// Animated Market Background
const canvas = document.getElementById('marketCanvas');
if (canvas) {
  const ctx = canvas.getContext('2d');
  
  function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);
  
  const points = [];
  const numLines = 8;
  const pointsPerLine = 50;
  
  // Create multiple chart lines
  for (let line = 0; line < numLines; line++) {
    const linePoints = [];
    const baseY = (canvas.height / (numLines + 1)) * (line + 1);
    
    for (let i = 0; i < pointsPerLine; i++) {
      linePoints.push({
        x: (i / pointsPerLine) * canvas.width,
        y: baseY + (Math.random() - 0.5) * 100,
        vy: (Math.random() - 0.5) * 0.3,
        originalY: baseY
      });
    }
    points.push(linePoints);
  }
  
  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    points.forEach((linePoints, lineIndex) => {
      // Update points
      linePoints.forEach(point => {
        point.y += point.vy;
        
        // Bounce back towards original position
        if (Math.abs(point.y - point.originalY) > 60) {
          point.vy *= -0.8;
        }
      });
      
      // Draw line
      const gradient = ctx.createLinearGradient(0, 0, canvas.width, 0);
      gradient.addColorStop(0, 'rgba(232, 168, 56, 0.15)');
      gradient.addColorStop(0.5, 'rgba(232, 168, 56, 0.3)');
      gradient.addColorStop(1, 'rgba(232, 168, 56, 0.15)');
      
      ctx.strokeStyle = gradient;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(linePoints[0].x, linePoints[0].y);
      
      for (let i = 1; i < linePoints.length; i++) {
        ctx.lineTo(linePoints[i].x, linePoints[i].y);
      }
      
      ctx.stroke();
      
      // Draw points
      ctx.fillStyle = 'rgba(232, 168, 56, 0.2)';
      linePoints.forEach((point, i) => {
        if (i % 5 === 0) {
          ctx.beginPath();
          ctx.arc(point.x, point.y, 2, 0, Math.PI * 2);
          ctx.fill();
        }
      });
    });
    
    requestAnimationFrame(animate);
  }
  
  animate();
}

// Multi-step Form Navigation
let currentStep = 1;

function nextStep(step) {
  document.querySelectorAll('.plan-section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.step-dot').forEach(d => d.classList.remove('active'));
  
  for (let i = 1; i < step; i++) {
    document.querySelector(`.step-dot[data-step="${i}"]`).classList.add('done');
  }
  
  document.querySelector(`.plan-section[data-step="${step}"]`).classList.add('active');
  document.querySelector(`.step-dot[data-step="${step}"]`).classList.add('active');
  
  currentStep = step;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function prevStep(step) {
  document.querySelectorAll('.plan-section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.step-dot').forEach(d => {
    d.classList.remove('active');
    d.classList.remove('done');
  });
  
  for (let i = 1; i < step; i++) {
    document.querySelector(`.step-dot[data-step="${i}"]`).classList.add('done');
  }
  
  document.querySelector(`.plan-section[data-step="${step}"]`).classList.add('active');
  document.querySelector(`.step-dot[data-step="${step}"]`).classList.add('active');
  
  currentStep = step;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

console.log('Fund Your Goals - Dark Mode Website Loaded');
