// Declaraciones de variables
let width = window.innerWidth;
let height = window.innerHeight;

const mainOrb = document.getElementById("main-orb");
const orbs = [];
const obstacles = [];

// Posición y estado de detección de la mano
let handPosition = { x: -1000, y: -1000, detected: false };
let lastHandUpdateTime = 0;
const handDetectionTimeout = 1500; // Tiempo en ms sin detección para resetear estado

// **IMPORTANTE**: gameActive indica si el juego está en curso (no terminado).
// gameRunning indica si la lógica del juego (movimiento, colisiones) está activa.
let gameActive = false; // Se activa después de la pantalla de introducción.
let gameRunning = false; // Se activa después del conteo regresivo.
let handReady = false; // Nueva variable para controlar si la mano ha sido detectada inicialmente

// Estado del juego
let caughtOrbsCount = 0;
let deliveredOrbsCount = 0; // Contador TOTAL de orbes entregados (acumulativo a través de los niveles)
let deliveredOrbsCount_currentLevel = 0; // Contador de orbes entregados en el NIVEL ACTUAL

const scoreDisplay = document.getElementById("score-display");
const deliveredScoreDisplay = document.getElementById(
  "delivered-score-display"
);
const goalArea = document.getElementById("goal-area");
const goalDeliveredCount = document.getElementById("goal-delivered-count");
const goalLevelDisplay = document.getElementById("goal-level");
const winMessage = document.getElementById("win-message");
const levelUpMessage = document.getElementById("level-up-message");
const currentLevelMessage = document.getElementById("current-level-message");
const countdownMessage = document.getElementById("countdown-message");

// --- Nuevos elementos de UI ---
const handDetectionScreen = document.getElementById("hand-detection-screen");

// --- Configuración de Niveles ---
let currentLevel = 1;
const BASE_OBSTACLE_SPEED = 3; // VELOCIDAD INICIAL BASE DE LOS OBSTÁCULOS (AUMENTADA)

// Define cuántos orbes se necesitan para completar cada nivel
const ORBS_PER_LEVEL = [10, 20, 30]; // Nivel 1 (10 orbes), Nivel 2 (20 orbes), Nivel 3 (30 orbes)

// Calcular el número total de orbes necesario para todo el juego
const TOTAL_ORBS_IN_GAME = ORBS_PER_LEVEL.reduce(
  (sum, current) => sum + current,
  0
);

// Configuración de velocidad y cantidad de obstáculos por nivel
const LEVEL_CONFIGS = [
  // Nivel 1
  {
    maxSpeedMultiplier: 2.5,
    initialOrbs: 10,
    initialObstacles: 3,
    maxObstacles: 5,
  }, // Multiplicador aumentado
  // Nivel 2
  {
    maxSpeedMultiplier: 4.5,
    initialOrbs: 20,
    initialObstacles: 5,
    maxObstacles: 10,
  }, // Multiplicador aumentado
  // Nivel 3
  {
    maxSpeedMultiplier: 7.0,
    initialOrbs: 30,
    initialObstacles: 8,
    maxObstacles: 15,
  }, // Multiplicador aumentado
];

// Contexto de audio (se mantiene aunque no se carguen MP3)
const audioContext = new (window.AudioContext || window.webkitAudioContext)();

// Configuración de GSAP para animaciones fluidas y optimizadas
gsap.config({ force3D: true });

// Función para posicionar la meta de forma responsiva
function positionGoalArea() {
  if (goalArea.offsetWidth === 0 || goalArea.offsetHeight === 0) {
    setTimeout(positionGoalArea, 10);
    return;
  }
  const goalWidth = goalArea.offsetWidth;
  const goalHeight = goalArea.offsetHeight;
  const padding = 50;
  let targetX = width - goalWidth - padding;
  let targetY = height - goalHeight - padding;
  targetX = Math.max(0, targetX);
  targetY = Math.max(0, targetY);
  gsap.set(goalArea, { x: targetX, y: targetY });
}

// Crear Orbes secundarios (atraíbles) dinámicamente
// Se crean de una vez todos los orbes que se usarán en el juego
for (let i = 0; i < TOTAL_ORBS_IN_GAME; i++) {
  const orb = document.createElement("div");
  orb.className = "orb";
  const initialScale = 0.5 + Math.random() * 0.5;
  gsap.set(orb, {
    x: Math.random() * (width - 60),
    y: Math.random() * (height - 60),
    scale: initialScale,
    opacity: 0.5 + Math.random() * 0.3,
  });
  orb.vx = (Math.random() - 0.5) * 2;
  orb.vy = (Math.random() - 0.5) * 2;
  orb.isCaught = false;
  orb.initialScale = initialScale;
  orb.canBeCaught = true;
  orb.style.display = "none"; // Ocultos inicialmente, se mostrarán en resetOrbsForLevel
  document.body.appendChild(orb);
  orbs.push(orb);
}

// Función para crear un nuevo obstáculo
function createObstacle() {
  const obstacle = document.createElement("div");
  obstacle.className = "obstacle";
  // Asegurarse de que los nuevos obstáculos no se superpongan a la meta al inicio
  let newX, newY;
  const buffer = 100; // Espacio alrededor de la meta
  do {
    newX = Math.random() * (width - 80);
    newY = Math.random() * (height - 80);
  } while (
    checkCollision(
      { x: newX, y: newY, width: 80, height: 80 },
      {
        x: gsap.getProperty(goalArea, "x") - buffer,
        y: gsap.getProperty(goalArea, "y") - buffer,
        width: goalArea.offsetWidth + 2 * buffer,
        height: goalArea.offsetHeight + 2 * buffer,
      }
    )
  );

  gsap.set(obstacle, { x: newX, y: newY });
  obstacle.baseVx = (Math.random() - 0.5) * BASE_OBSTACLE_SPEED;
  obstacle.baseVy = (Math.random() - 0.5) * BASE_OBSTACLE_SPEED;
  document.body.appendChild(obstacle);
  obstacles.push(obstacle);
}

// Función para limpiar todos los obstáculos existentes
function clearObstacles() {
  obstacles.forEach((obstacle) => obstacle.remove());
  obstacles.length = 0; // Vaciar el array
}

// Función para inicializar los obstáculos de un nuevo nivel
function setupObstaclesForLevel(levelConfig) {
  clearObstacles(); // Eliminar todos los obstáculos anteriores
  for (let i = 0; i < levelConfig.initialObstacles; i++) {
    createObstacle();
  }
}

// Función para detectar colisión entre dos elementos
function checkCollision(element1, element2) {
  const rect1 = element1.getBoundingClientRect
    ? element1.getBoundingClientRect()
    : element1;
  const rect2 = element2.getBoundingClientRect
    ? element2.getBoundingClientRect()
    : element2;

  return (
    rect1.x < rect2.x + rect2.width &&
    rect1.x + rect1.width > rect2.x &&
    rect1.y < rect2.y + rect2.height &&
    rect1.y + rect2.height > rect2.y
  );
}

// Función para dispersar TODOS los orbes que estaban atrapados
function disperseCaughtOrbs() {
  orbs.forEach((orb) => {
    if (orb.isCaught) {
      orb.isCaught = false;
      orb.classList.remove("caught");
      orb.canBeCaught = false;

      orb.style.display = "block";

      gsap.to(orb, {
        duration: 0.5,
        scale: orb.initialScale,
        filter: `blur(8px) brightness(1)`,
        ease: "power2.out",
      });

      orb.vx = (Math.random() - 0.5) * 30; // Mayor velocidad de dispersión
      orb.vy = (Math.random() - 0.5) * 30;

      gsap.delayedCall(1, () => {
        orb.canBeCaught = true;
      });
    }
  });
  caughtOrbsCount = 0;
  scoreDisplay.textContent = `Orbes Atrapados: ${caughtOrbsCount}`;
  toggleMainOrbGlow(); // Restaurar brillo del orbe principal
}

// Alternar la animación de brillo del orbe principal
function toggleMainOrbGlow() {
  if (caughtOrbsCount === 0) {
    mainOrb.classList.add("idle-glow");
  } else {
    mainOrb.classList.remove("idle-glow");
  }
}

// Función para actualizar la UI de la meta y los contadores
function updateUI() {
  const orbsNeeded = ORBS_PER_LEVEL[currentLevel - 1];
  goalDeliveredCount.textContent = `${deliveredOrbsCount_currentLevel} / ${orbsNeeded}`;
  goalLevelDisplay.textContent = `Nivel: ${currentLevel}`;
  scoreDisplay.textContent = `Orbes Atrapados: ${caughtOrbsCount}`;
  deliveredScoreDisplay.textContent = `Orbes Entregados: ${deliveredOrbsCount_currentLevel} / ${orbsNeeded}`;
  toggleMainOrbGlow(); // Actualizar el brillo del orbe principal
}

// Función para mostrar un mensaje de nivel (inicio o avance)
function showLevelMessage(levelNum) {
  currentLevelMessage.textContent = `¡NIVEL ${levelNum}!`;
  currentLevelMessage.style.display = "block";
  gsap.fromTo(
    currentLevelMessage,
    { opacity: 0, scale: 0.8 },
    { opacity: 1, scale: 1, duration: 0.5, ease: "back.out(1.7)" }
  );
  gsap.to(currentLevelMessage, {
    opacity: 0,
    delay: 1.5, // Cuánto tiempo se queda visible
    duration: 0.5,
    onComplete: () => {
      currentLevelMessage.style.display = "none";
    },
  });
}

// Función para resetear y reposicionar orbes para un nuevo nivel
function resetOrbsForLevel() {
  let orbsToActivate = ORBS_PER_LEVEL[currentLevel - 1];

  // Ocultar todos los orbes
  orbs.forEach((orb) => {
    orb.style.display = "none";
    gsap.killTweensOf(orb); // Detener cualquier animación en curso
  });

  // Activar y reposicionar solo la cantidad necesaria para el nivel actual
  for (let i = 0; i < orbsToActivate; i++) {
    const orb = orbs[i];
    orb.isCaught = false;
    orb.classList.remove("caught");
    orb.canBeCaught = true;
    orb.style.display = "block";
    // Asegurarse de que los orbes no aparezcan dentro de la meta o sobre un obstáculo
    let newX, newY;
    const buffer = 100; // Espacio alrededor de la meta y obstáculos
    let collisionDetected = true;
    while (collisionDetected) {
      newX = Math.random() * (width - 60);
      newY = Math.random() * (height - 60);

      collisionDetected = false;
      // Check collision with goal area
      if (
        checkCollision(
          { x: newX, y: newY, width: 60, height: 60 },
          {
            x: gsap.getProperty(goalArea, "x") - buffer,
            y: gsap.getProperty(goalArea, "y") - buffer,
            width: goalArea.offsetWidth + 2 * buffer,
            height: goalArea.offsetHeight + 2 * buffer,
          }
        )
      ) {
        collisionDetected = true;
      }
      // Check collision with existing obstacles (only if some exist)
      if (!collisionDetected && obstacles.length > 0) {
        for (let j = 0; j < obstacles.length; j++) {
          const obstacle = obstacles[j];
          if (
            checkCollision(
              { x: newX, y: newY, width: 60, height: 60 },
              {
                x: gsap.getProperty(obstacle, "x") - buffer,
                y: gsap.getProperty(obstacle, "y") - buffer,
                width: obstacle.offsetWidth + 2 * buffer,
                height: obstacle.offsetHeight + 2 * buffer,
              }
            )
          ) {
            collisionDetected = true;
            break;
          }
        }
      }
    }

    gsap.set(orb, {
      x: newX,
      y: newY,
      scale: orb.initialScale,
      opacity: 0.5 + Math.random() * 0.3,
    });
    orb.vx = (Math.random() - 0.5) * 2;
    orb.vy = (Math.random() - 0.5) * 2;
  }
}

// Función para iniciar el conteo regresivo
function startCountdown() {
  gameRunning = false; // Pausar la lógica del juego
  countdownMessage.style.display = "block";
  gsap.to(countdownMessage, { opacity: 1, duration: 0.2 });

  let count = 3;
  countdownMessage.textContent = count;

  const countdownInterval = setInterval(() => {
    count--;
    if (count > 0) {
      countdownMessage.textContent = count;
      gsap.fromTo(
        countdownMessage,
        { scale: 1.2, opacity: 0.5 },
        { scale: 1, opacity: 1, duration: 0.4, ease: "back.out(1.7)" }
      );
    } else if (count === 0) {
      countdownMessage.textContent = "¡ADELANTE!";
      gsap.fromTo(
        countdownMessage,
        { scale: 1.5, opacity: 0 },
        { scale: 1, opacity: 1, duration: 0.5, ease: "elastic.out(1, 0.5)" }
      );
    } else {
      clearInterval(countdownInterval);
      gsap.to(countdownMessage, {
        opacity: 0,
        duration: 0.5,
        onComplete: () => {
          countdownMessage.style.display = "none";
          gameRunning = true; // Reanudar la lógica del juego
        },
      });
    }
  }, 1000);
}

// Función para la animación de transición entre niveles
function levelTransitionAnimation(onCompleteCallback) {
  gameRunning = false; // Detener la lógica del juego durante la transición

  // Animación del orbe principal: se expande y se desvanece
  gsap.to(mainOrb, {
    scale: 3, // Más grande
    opacity: 0,
    filter: "blur(20px) brightness(3)",
    duration: 0.8,
    ease: "power2.out",
    onComplete: () => {
      // Resetear la escala y opacidad para el siguiente nivel
      gsap.set(mainOrb, {
        scale: 1,
        opacity: 1,
        filter: "blur(5px) brightness(1.5)",
      });
    },
  });

  // Animación de los orbes secundarios: se desvanecen rápidamente
  orbs.forEach((orb, index) => {
    if (orb.style.display !== "none") {
      // Solo animar los orbes visibles
      gsap.to(orb, {
        opacity: 0,
        scale: 0.5,
        filter: "blur(15px)",
        duration: 0.3,
        delay: index * 0.02, // Retraso escalonado para un efecto de "ola"
        ease: "power1.in",
        onComplete: () => {
          orb.style.display = "none"; // Ocultar al terminar la animación
        },
      });
    }
  });

  // Animación de los obstáculos: se encogen y desvanecen
  obstacles.forEach((obstacle, index) => {
    gsap.to(obstacle, {
      opacity: 0,
      scale: 0,
      duration: 0.4,
      delay: index * 0.03, // Retraso escalonado
      ease: "power1.in",
      onComplete: () => {
        obstacle.remove(); // Eliminar el elemento del DOM
      },
    });
  });

  // Esperar a que las animaciones terminen antes de llamar al callback
  gsap.delayedCall(1.0, onCompleteCallback); // Ajusta este tiempo si las animaciones son más largas
}

// Función para pasar al siguiente nivel
function goToNextLevel() {
  levelTransitionAnimation(() => {
    // Iniciar la animación de transición
    currentLevel++;
    if (currentLevel > LEVEL_CONFIGS.length) {
      // El juego ha terminado
      winMessage.style.display = "flex"; // Usar flex para centrar los dos textos
      gameActive = false; // El juego ya no está activo
      camera.stop();
      document.body.classList.remove("hide-cursor");
      return;
    }

    // Reiniciar contadores para el nuevo nivel
    deliveredOrbsCount_currentLevel = 0;
    caughtOrbsCount = 0;

    // Primero configurar obstáculos, luego orbes para evitar colisiones iniciales
    setupObstaclesForLevel(LEVEL_CONFIGS[currentLevel - 1]);
    resetOrbsForLevel(); // Resetear y reposicionar los orbes
    updateUI(); // Actualizar la UI de la meta y contadores

    showLevelMessage(currentLevel); // Muestra el mensaje "¡NIVEL X!"
    startCountdown(); // Iniciar el conteo regresivo para el nuevo nivel
  });
}

// Bucle de animación principal
function animate() {
  // Solo ejecuta la lógica de movimiento y colisiones si el juego está corriendo
  if (gameRunning) {
    const currentLevelConfig = LEVEL_CONFIGS[currentLevel - 1];

    const currentDifficultyMultiplier = currentLevelConfig.maxSpeedMultiplier;

    const orbsNeededForCurrentLevel = ORBS_PER_LEVEL[currentLevel - 1];
    const obstacleSpawnProgress = Math.min(
      deliveredOrbsCount_currentLevel / orbsNeededForCurrentLevel,
      1
    );
    const targetObstacles =
      currentLevelConfig.initialObstacles +
      Math.floor(
        (currentLevelConfig.maxObstacles -
          currentLevelConfig.initialObstacles) *
          obstacleSpawnProgress
      );

    // Añadir nuevos obstáculos si es necesario
    while (obstacles.length < targetObstacles) {
      createObstacle();
    }

    // Animación y lógica de orbes secundarios
    orbs.forEach((orb) => {
      if (orb.style.display === "none") {
        return;
      }

      const orbX = gsap.getProperty(orb, "x");
      const orbY = gsap.getProperty(orb, "y");

      // Rebote suave en los bordes de la pantalla para ORBES
      if (orbX + orb.vx <= 0 || orbX + orb.offsetWidth + orb.vx >= width) {
        orb.vx *= -0.9;
        gsap.set(orb, {
          x: Math.max(0, Math.min(width - orb.offsetWidth, orbX + orb.vx)),
        });
      }
      if (orbY + orb.vy <= 0 || orbY + orb.offsetHeight + orb.vy >= height) {
        orb.vy *= -0.9;
        gsap.set(orb, {
          y: Math.max(0, Math.min(height - orb.offsetHeight, orbY + orb.vy)),
        });
      }

      if (!orb.isCaught) {
        const dx =
          gsap.getProperty(mainOrb, "x") + mainOrb.offsetWidth / 2 - orbX;
        const dy =
          gsap.getProperty(mainOrb, "y") + mainOrb.offsetHeight / 2 - orbY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        const attractionRadius = 200;
        const catchRadius = 80;

        if (orb.canBeCaught) {
          if (dist < catchRadius) {
            if (!orb.isCaught) {
              orb.isCaught = true;
              orb.classList.add("caught");
              caughtOrbsCount++;
              updateUI();
              gsap.to(orb, { duration: 0.2, scale: 0.8, ease: "power2.out" });
            }
          } else if (dist < attractionRadius) {
            const angle = Math.atan2(dy, dx);
            orb.vx += Math.cos(angle) * ((attractionRadius - dist) * 0.005);
            orb.vy += Math.sin(angle) * ((attractionRadius - dist) * 0.005);
          }
        }

        if (Math.abs(orb.vx) < 0.1 && Math.abs(orb.vy) < 0.1) {
          orb.vx = (Math.random() - 0.5) * 0.5;
          orb.vy = (Math.random() - 0.5) * 0.5;
        }
        orb.vx *= 0.99;
        orb.vy *= 0.99;

        gsap.set(orb, { x: `+=${orb.vx}`, y: `+=${orb.vy}` });
      } else {
        // Si el orbe está atrapado, se mueve con el orbe principal
        gsap.to(orb, {
          duration: 0.5,
          x: gsap.getProperty(mainOrb, "x") + (Math.random() - 0.5) * 40,
          y: gsap.getProperty(mainOrb, "y") + (Math.random() - 0.5) * 40,
          ease: "power1.out",
        });

        // Colisión de orbes atrapados con obstáculos
        obstacles.forEach((obstacle) => {
          if (checkCollision(orb, obstacle)) {
            disperseCaughtOrbs();
          }
        });
      }

      // Detección de colisión de orbes atrapados con la meta
      if (orb.isCaught && checkCollision(orb, goalArea)) {
        orb.isCaught = false;
        orb.classList.remove("caught");
        orb.style.display = "none";

        deliveredOrbsCount++;
        deliveredOrbsCount_currentLevel++;

        updateUI();

        caughtOrbsCount--;
        if (caughtOrbsCount < 0) caughtOrbsCount = 0;
        updateUI();

        // Comprobar si se ha completado el nivel actual
        if (
          deliveredOrbsCount_currentLevel >= ORBS_PER_LEVEL[currentLevel - 1]
        ) {
          goToNextLevel();
        }
      }
    });

    // Animación de obstáculos (movimiento libre)
    obstacles.forEach((obstacle) => {
      let obstacleX = gsap.getProperty(obstacle, "x");
      let obstacleY = gsap.getProperty(obstacle, "y");

      const effectiveVx = obstacle.baseVx * currentDifficultyMultiplier;
      const effectiveVy = obstacle.baseVy * currentDifficultyMultiplier;

      let bouncedX = false;
      let bouncedY = false;

      // Rebote de obstáculos en los bordes horizontales
      if (obstacleX + effectiveVx <= 0) {
        obstacle.baseVx *= -1;
        obstacleX = 0;
        bouncedX = true;
      } else if (obstacleX + obstacle.offsetWidth + effectiveVx >= width) {
        obstacle.baseVx *= -1;
        obstacleX = width - obstacle.offsetWidth;
        bouncedX = true;
      }

      // Rebote de obstáculos en los bordes verticales
      if (obstacleY + effectiveVy <= 0) {
        obstacle.baseVy *= -1;
        obstacleY = 0;
        bouncedY = true;
      } else if (obstacleY + obstacle.offsetHeight + effectiveVy >= height) {
        obstacle.baseVy *= -1;
        obstacleY = height - obstacle.offsetHeight;
        bouncedY = true;
      }

      if (
        Math.abs(obstacle.baseVx) < 0.1 * currentDifficultyMultiplier &&
        Math.abs(obstacle.baseVy) < 0.1 * currentDifficultyMultiplier
      ) {
        obstacle.baseVx = (Math.random() - 0.5) * BASE_OBSTACLE_SPEED;
        obstacle.baseVy = (Math.random() - 0.5) * BASE_OBSTACLE_SPEED;
      }

      if (!bouncedX) {
        obstacleX += effectiveVx;
      }
      if (!bouncedY) {
        obstacleY += effectiveVy;
      }

      gsap.set(obstacle, { x: obstacleX, y: obstacleY });
    });
  }

  // Actualizar posición del orbe principal con la mano detectada
  // Ahora, el orbe se mueve con la mano solo si handReady es true
  if (handPosition.detected) {
    if (handReady) {
      // Solo mover el orbe si la mano está lista y detectada
      gsap.to(mainOrb, {
        duration: 0.1,
        x: handPosition.x - mainOrb.offsetWidth / 2,
        y: handPosition.y - mainOrb.offsetHeight / 2,
        ease: "power1.out",
      });
    } else {
      // Si la mano se detecta por primera vez en la pantalla de espera
      // Posicionar el orbe instantáneamente a la mano para que se vea que está "conectado"
      gsap.set(mainOrb, {
        x: handPosition.x - mainOrb.offsetWidth / 2,
        y: handPosition.y - mainOrb.offsetHeight / 2,
      });
    }
    mainOrb.classList.remove("idle-glow"); // Quitar brillo si la mano es detectada
  } else {
    // Si la mano no está detectada, el orbe principal se queda estático
    mainOrb.classList.add("idle-glow"); // Añadir brillo si la mano no es detectada
  }

  // Actualizar el estado de la mano: si no se detecta por un tiempo, se asume que se ha ido
  const now = performance.now();
  if (
    handPosition.detected &&
    now - lastHandUpdateTime > handDetectionTimeout &&
    gameRunning
  ) {
    handPosition.detected = false;
    handPosition.x = -1000;
    handPosition.y = -1000;
    document.getElementById("hand-status").textContent = "Mano no detectada.";
    document.getElementById("hand-status").style.color = "#aaa";
    disperseCaughtOrbs();
  }

  requestAnimationFrame(animate); // Seguir animando el bucle principal
}

// --- Lógica de la Pantalla de Inicio y Detección de Mano ---
const introScreen = document.getElementById("intro-screen");
const startButton = document.getElementById("start-button");
const mainCanvas = document.getElementById("main-canvas");

startButton.addEventListener("click", () => {
  introScreen.classList.add("fade-out");
  setTimeout(() => {
    introScreen.style.display = "none";
    mainCanvas.style.display = "block"; // Mostrar el canvas principal
    document.body.classList.add("hide-cursor");
    positionGoalArea();

    // Mostrar la pantalla de detección de mano
    handDetectionScreen.classList.add("active");
    mainOrb.classList.add("idle-glow"); // El orbe principal brilla mientras espera la mano

    // === CAMBIO CLAVE AQUÍ: Iniciar la cámara directamente al hacer clic en el botón ===
    camera.start();
    if (audioContext.state === "suspended") {
      audioContext.resume();
    }

    // Iniciar el bucle de animación para que el orbe principal pueda brillar
    // y para que la detección de mano funcione en la pantalla de espera.
    animate();
  }, 1000);
});

// --- Inicialización de MediaPipe Hands ---
const videoElement = document.getElementById("input_video");
const handStatusText = document.getElementById("hand-status");

const hands = new Hands({
  locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
});

hands.setOptions({
  maxNumHands: 1,
  modelComplexity: 1,
  minDetectionConfidence: 0.7,
  minTrackingConfidence: 0.5,
});

hands.onResults((results) => {
  if (!gameActive && !handReady) {
    // Si el juego no ha empezado y la mano no está lista
    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
      handPosition.x = (1 - results.multiHandLandmarks[0][9].x) * width;
      handPosition.y = results.multiHandLandmarks[0][9].y * height;
      handPosition.detected = true;
      lastHandUpdateTime = performance.now();
      handStatusText.textContent = "Mano detectada. ¡Listo para empezar!";
      handStatusText.style.color = "#00ff00"; // Verde para indicar que está listo

      // Transición de la pantalla de detección de mano al juego
      handDetectionScreen.classList.remove("active");
      gsap.to(handDetectionScreen, {
        opacity: 0,
        duration: 0.5,
        onComplete: () => {
          handDetectionScreen.style.display = "none";
          handReady = true; // La mano ya fue detectada inicialmente
          gameActive = true; // El juego ya está activo

          // Reiniciar contadores para el primer nivel al inicio del juego
          currentLevel = 1;
          deliveredOrbsCount = 0;
          deliveredOrbsCount_currentLevel = 0;
          caughtOrbsCount = 0;

          // Primero configurar obstáculos, luego orbes para evitar colisiones iniciales
          setupObstaclesForLevel(LEVEL_CONFIGS[0]);
          resetOrbsForLevel();
          updateUI();

          showLevelMessage(1);
          startCountdown(); // Iniciar el conteo regresivo
        },
      });
    } else {
      handStatusText.textContent = "Mano no detectada. Esperando...";
      handStatusText.style.color = "#aaa";
      handPosition.detected = false; // Asegurar que el estado es "no detectado"
      mainOrb.classList.add("idle-glow"); // Mantener el brillo si no hay mano
    }
    return; // Salir de la función si estamos en la pantalla de detección de mano inicial
  }

  // Lógica normal de detección de mano durante el juego (si ya está activo y la mano fue detectada una vez)
  if (gameActive) {
    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
      const landmark = results.multiHandLandmarks[0][9];
      handPosition.x = (1 - landmark.x) * width;
      handPosition.y = landmark.y * height;
      handPosition.detected = true;
      lastHandUpdateTime = performance.now();
      handStatusText.textContent = "Mano detectada. ¡Mueve el orbe!";
      handStatusText.style.color = "#00ffff";
    } else {
      handStatusText.textContent = "Mano no detectada. Esperando...";
      handStatusText.style.color = "#aaa";
      if (gameRunning) {
        // Solo dispersar orbes si el juego está "corriendo"
        disperseCaughtOrbs();
      }
      handPosition.detected = false;
    }
  }
});

const camera = new Camera(videoElement, {
  onFrame: async () => {
    // La cámara envía frames siempre que la pantalla de detección de mano esté activa
    // o si el juego está activo.
    if (handDetectionScreen.classList.contains("active") || gameActive) {
      await hands.send({ image: videoElement });
    }
  },
  width: 640,
  height: 480,
});

window.addEventListener("resize", () => {
  width = window.innerWidth;
  height = window.innerHeight;
  positionGoalArea();
});

document.addEventListener("DOMContentLoaded", () => {
  // Asegurarse de que el cursor sea visible al inicio en la pantalla de introducción.
  // Se ocultará una vez que el juego comience de verdad.
  document.body.classList.remove("hide-cursor");
});
