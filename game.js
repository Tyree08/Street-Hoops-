
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const W = canvas.width;
const H = canvas.height;

const keys = {};

let blueScore = 0;
let redScore = 0;
let gameMode = "21";
let gameRunning = false;
let gameOver = false;
let timeLeft = 180;
let lastTime = 0;
let cpuCooldown = 0;
let shot = null;

const blueTeam = [];
const redTeam = [];

const ball = {
  x: 300,
  y: 300,
  owner: null,
  radius: 9
};

function createPlayer(team, number, x, y) {
  return {
    team,
    number,
    x,
    y,
    speed: 175,
    radius: 16,
    homeX: x,
    homeY: y
  };
}

function createTeams() {
  blueTeam.length = 0;
  redTeam.length = 0;

  const bluePositions = [
    [270, 300],
    [220, 180],
    [220, 420],
    [350, 170],
    [350, 430]
  ];

  const redPositions = [
    [690, 300],
    [740, 180],
    [740, 420],
    [610, 170],
    [610, 430]
  ];

  bluePositions.forEach((p, i) => {
    blueTeam.push(createPlayer("blue", i + 1, p[0], p[1]));
  });

  redPositions.forEach((p, i) => {
    redTeam.push(createPlayer("red", i + 1, p[0], p[1]));
  });

  ball.owner = blueTeam[0];
  updateBall();
}

function updateBall() {
  if (ball.owner) {
    ball.x = ball.owner.x + 12;
    ball.y = ball.owner.y + 5;
  }
}

function startGame(mode) {
  gameMode = mode;
  resetGame();
  gameRunning = true;
  document.getElementById("message").textContent =
    mode === "21" ? "FIRST TEAM TO 21 WINS!" : "3-MINUTE MATCH!";
}

function resetGame() {
  blueScore = 0;
  redScore = 0;
  timeLeft = 180;
  gameOver = false;
  shot = null;
  cpuCooldown = 1;
  createTeams();
  gameRunning = false;
  updateScoreboard();

  document.getElementById("clock").textContent = "03:00";
  document.getElementById("message").textContent =
    "CHOOSE YOUR GAME MODE!";
}

function updateScoreboard() {
  document.getElementById("blueScore").textContent = blueScore;
  document.getElementById("redScore").textContent = redScore;
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function moveToward(player, targetX, targetY, speed, dt) {
  const dx = targetX - player.x;
  const dy = targetY - player.y;
  const length = Math.hypot(dx, dy);

  if (length > 2) {
    player.x += (dx / length) * speed * dt;
    player.y += (dy / length) * speed * dt;
  }
}

function getNearestPlayer(team, target, exclude) {
  let nearest = null;
  let bestDistance = Infinity;

  team.forEach(player => {
    if (player === exclude) return;

    const d = distance(player, target);

    if (d < bestDistance) {
      bestDistance = d;
      nearest = player;
    }
  });

  return nearest;
}

function moveUser(dt) {
  const player = blueTeam[0];

  let dx = 0;
  let dy = 0;

  if (keys["w"] || keys["arrowup"]) dy--;
  if (keys["s"] || keys["arrowdown"]) dy++;
  if (keys["a"] || keys["arrowleft"]) dx--;
  if (keys["d"] || keys["arrowright"]) dx++;

  const length = Math.hypot(dx, dy);

  if (length > 0) {
    const sprint = keys["shift"] ? 1.5 : 1;
    player.x += (dx / length) * player.speed * sprint * dt;
    player.y += (dy / length) * player.speed * sprint * dt;
  }

  player.x = clamp(player.x, 65, 895);
  player.y = clamp(player.y, 65, 535);
}

function moveTeammates(dt) {
  const carrier = ball.owner;

  blueTeam.slice(1).forEach((player, i) => {
    let targetX = player.homeX;
    let targetY = player.homeY;

    if (carrier && carrier.team === "blue") {
      targetX = clamp(carrier.x + 60, 100, 850);
      targetY = clamp(player.homeY + (carrier.y - 300) * 0.15, 80, 520);
    }

    moveToward(player, targetX, targetY, 100, dt);
  });

  redTeam.slice(1).forEach((player, i) => {
    let targetX = player.homeX;
    let targetY = player.homeY;

    if (carrier && carrier.team === "red") {
      targetX = clamp(carrier.x - 60, 100, 850);
      targetY = clamp(player.homeY + (carrier.y - 300) * 0.15, 80, 520);
    }

    moveToward(player, targetX, targetY, 95, dt);
  });
}

function moveCPU(dt) {
  const carrier = ball.owner;

  if (!carrier) return;

  if (carrier.team === "red") {
    moveToward(carrier, 75, 300, 105, dt);

    const defender = getNearestPlayer(blueTeam, carrier, null);

    if (defender && distance(defender, carrier) < 34) {
      if (Math.random() < 0.025) {
        ball.owner = defender;
      }
    }

    if (carrier.x < 260 && cpuCooldown <= 0) {
      shootBall(carrier);
      cpuCooldown = 2;
    }
  } else {
    const defender = getNearestPlayer(redTeam, carrier, null);

    if (defender) {
      moveToward(defender, carrier.x - 15, carrier.y, 115, dt);
    }
  }
}

function passBall() {
  if (!gameRunning || gameOver || shot) return;
  if (!ball.owner || ball.owner.team !== "blue") return;

  const teammate = getNearestPlayer(blueTeam, ball.owner, null);

  if (teammate) {
    ball.owner = teammate;
    document.getElementById("message").textContent = "NICE PASS!";
  }
}

function stealBall() {
  if (!gameRunning || gameOver || shot) return;

  const user = blueTeam[0];

  if (ball.owner && ball.owner.team === "red") {
    if (distance(user, ball.owner) < 55) {
      ball.owner = user;
      document.getElementById("message").textContent = "STEAL!";
    }
  }
}

function shootBall(player) {
  if (!player || !ball.owner || ball.owner !== player || shot) return;

  const targetX = player.team === "blue" ? 900 : 60;
  const targetY = 300;

  const hoop = { x: targetX, y: targetY };
  const d = distance(player, hoop);

  const accuracy = Math.max(0.35, 0.88 - d / 1200);
  const made = Math.random() < accuracy;

  shot = {
    x: ball.x,
    y: ball.y,
    startX: ball.x,
    startY: ball.y,
    targetX,
    targetY,
    progress: 0,
    duration: 0.7,
    made,
    team: player.team,
    player
  };

  ball.owner = null;
}

function updateShot(dt) {
  if (!shot) return;

  shot.progress += dt / shot.duration;

  const p = Math.min(shot.progress, 1);

  shot.x = shot.startX + (shot.targetX - shot.startX) * p;
  shot.y = shot.startY + (shot.targetY - shot.startY) * p;

  if (p >= 1) {
    if (shot.made) {
      if (shot.team === "blue") blueScore += 2;
      else redScore += 2;

      document.getElementById("message").textContent =
        shot.team === "blue" ? "BLUE TEAM SCORES!" : "RED TEAM SCORES!";
    } else {
      document.getElementById("message").textContent = "MISSED SHOT!";
    }

    updateScoreboard();

    const oldTeam = shot.team;
    shot = null;

    if (blueScore >= 21 && gameMode === "21") {
      endGame("BLUE TEAM WINS!");
      return;
    }

    if (redScore >= 21 && gameMode === "21") {
      endGame("RED TEAM WINS!");
      return;
    }

    const nextTeam = oldTeam === "blue" ? redTeam : blueTeam;
    ball.owner = nextTeam[0];

    if (oldTeam === "blue") {
      ball.owner = redTeam[0];
    } else {
      ball.owner = blueTeam[0];
    }

    ball.owner.x = oldTeam === "blue" ? 690 : 270;
    ball.owner.y = 300;
  }
}

function endGame(message) {
  gameOver = true;
  gameRunning = false;
  document.getElementById("message").textContent = message;
}

function updateClock(dt) {
  if (gameMode !== "timed") return;

  timeLeft -= dt;

  if (timeLeft <= 0) {
    timeLeft = 0;

    if (blueScore > redScore) endGame("BLUE TEAM WINS!");
    else if (redScore > blueScore) endGame("RED TEAM WINS!");
    else endGame("IT'S A TIE!");

  }

  const minutes = Math.floor(timeLeft / 60);
  const seconds = Math.floor(timeLeft % 60);

  document.getElementById("clock").textContent =
    String(minutes).padStart(2, "0") + ":" +
    String(seconds).padStart(2, "0");
}

function update(dt) {
  if (!gameRunning || gameOver) return;

  cpuCooldown -= dt;

  moveUser(dt);
  moveTeammates(dt);
  moveCPU(dt);
  updateShot(dt);
  updateClock(dt);
  updateBall();

  // Pick up a loose basketball.
  if (!ball.owner && !shot) {
    const allPlayers = [...blueTeam, ...redTeam];
    const nearest = allPlayers.reduce((best, player) =>
      distance(player, ball) < distance(best, ball) ? player : best
    );

    if (distance(nearest, ball) < 28) {
      ball.owner = nearest;
    }
  }
}

function drawCourt() {
  ctx.fillStyle = "#bd8750";
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = "#c99158";
  for (let x = 0; x < W; x += 80) {
    ctx.fillRect(x, 0, 40, H);
  }

  ctx.strokeStyle = "#fff0ce";
  ctx.lineWidth = 5;
  ctx.strokeRect(30, 30, 900, 540);

  ctx.beginPath();
  ctx.moveTo(480, 30);
  ctx.lineTo(480, 570);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(480, 300, 75, 0, Math.PI * 2);
  ctx.stroke();

  // Left key and hoop.
  ctx.strokeRect(30, 190, 150, 220);

  ctx.beginPath();
  ctx.arc(180, 300, 105, -Math.PI / 2, Math.PI / 2);
  ctx.stroke();

  // Right key and hoop.
  ctx.strokeRect(780, 190, 150, 220);

  ctx.beginPath();
  ctx.arc(780, 300, 105, Math.PI / 2, -Math.PI / 2);
  ctx.stroke();

  // Three-point lines.
  ctx.beginPath();
  ctx.arc(60, 300, 245, -Math.PI / 2, Math.PI / 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(900, 300, 245, Math.PI / 2, -Math.PI / 2);
  ctx.stroke();

  // Hoops.
  drawHoop(60, 300);
  drawHoop(900, 300);

  ctx.fillStyle = "rgba(0,0,0,0.16)";
  ctx.font = "bold 25px Courier New";
  ctx.fillText("STREET HOOPS", 355, 80);
  ctx.font = "bold 14px Courier New";
  ctx.fillText("'96", 460, 103);
}

function drawHoop(x, y) {
  ctx.strokeStyle = "#eeeeee";
  ctx.lineWidth = 6;

  ctx.beginPath();
  ctx.moveTo(x - 12, y - 25);
  ctx.lineTo(x - 12, y + 25);
  ctx.stroke();

  ctx.strokeStyle = "#f04b35";
  ctx.lineWidth = 4;

  ctx.beginPath();
  ctx.arc(x, y, 15, 0, Math.PI * 2);
  ctx.stroke();
}

function drawPlayer(player) {
  const color = player.team === "blue" ? "#238bd3" : "#d83c45";

  // Player shadow.
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.beginPath();
  ctx.ellipse(player.x, player.y + 8, 17, 9, 0, 0, Math.PI * 2);
  ctx.fill();

  // Player body.
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 2;
  ctx.stroke();

  // Jersey number.
  ctx.fillStyle = "white";
  ctx.font = "bold 12px Courier New";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(player.number, player.x, player.y);

  // Highlight controlled player.
  if (player === blueTeam[0]) {
    ctx.strokeStyle = "#fff36b";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(player.x, player.y, 23, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
}

function drawBall() {
  const x = shot ? shot.x : ball.x;
  const y = shot ? shot.y : ball.y;

  ctx.fillStyle = "#e77a25";
  ctx.beginPath();
  ctx.arc(x, y, ball.radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#512b15";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x - 8, y);
  ctx.lineTo(x + 8, y);
  ctx.moveTo(x, y - 8);
  ctx.lineTo(x, y + 8);
  ctx.stroke();
}

function draw() {
  drawCourt();

  blueTeam.forEach(drawPlayer);
  redTeam.forEach(drawPlayer);

  drawBall();
}

function gameLoop(timestamp) {
  const dt = Math.min((timestamp - lastTime) / 1000 || 0, 0.04);
  lastTime = timestamp;

  update(dt);
  draw();

  requestAnimationFrame(gameLoop);
}

document.addEventListener("keydown", event => {
  const key = event.key.toLowerCase();
  keys[key] = true;

  if ([" ", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(key)) {
    event.preventDefault();
  }

  if (key === " " && gameRunning && !gameOver) {
    shootBall(ball.owner === blueTeam[0] ? blueTeam[0] : null);
  }

  if (key === "q") passBall();
  if (key === "e") stealBall();
});

document.addEventListener("keyup", event => {
  keys[event.key.toLowerCase()] = false;
});

createTeams();
draw();
requestAnimationFrame(gameLoop);
