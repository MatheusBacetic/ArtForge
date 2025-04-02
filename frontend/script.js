// Variável GLOBAL
let isGenerating = false;

document.addEventListener("DOMContentLoaded", () => {
  const introScreen = document.getElementById("intro-screen");
  const logoIntro = document.getElementById("logo-intro");
  const mainContent = document.getElementById("main-content");
  const header = document.querySelector(".header");

  logoIntro.classList.add("pulse-in");

  logoIntro.addEventListener('animationend', () => {
    introScreen.classList.add('fade-out');
    header.classList.add('visible');
  });

  introScreen.addEventListener('transitionend', () => {
    introScreen.style.display = 'none';
    mainContent.style.display = 'flex';
    mainContent.classList.remove('hidden'); // Adicione esta linha
    initApp(); // Inicializa após animação
  }, { once: true });
});

function initApp() {
  setupInitialMenu();
  setupGenerateButton();
  loadHistory();
}

function setupInitialMenu() {
  const btnTextToImage = document.getElementById("btn-text-to-image");
  const textToImageSection = document.getElementById("text-to-image-section");
  const initialMenu = document.getElementById("initial-menu");

  if (btnTextToImage) {
    btnTextToImage.addEventListener("click", () => {
      console.log("Botão 'Iniciar' foi clicado.");
      btnTextToImage.remove();
      initialMenu.style.display = "none";
      textToImageSection.style.display = "flex";
      textToImageSection.style.justifyContent = "center";
    });
  }
}

function setupGenerateButton() {
  const generateImageBtn = document.getElementById("generate-button");
  const progressWrapper = document.querySelector(".progress-wrapper");
  const progressBar = document.getElementById("progress-bar");

  if (generateImageBtn) {
    generateImageBtn.addEventListener("click", async () => {
      if (isGenerating) return;
      isGenerating = true;

      progressWrapper.style.display = "block";
      progressBar.style.width = "0%";

      const prompt = document.getElementById("description-input")?.value.trim();
      const quality = document.getElementById("quality-select")?.value;

      if (!prompt || !quality) {
        alert("Preencha todos os campos!");
        progressWrapper.style.display = "none";
        isGenerating = false;
        return;
      }

      try {
        const response = await fetch("http://127.0.0.1:5000/start_generation", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt, quality }),
        });

        if (!response.ok) throw new Error("Erro ao iniciar geração");
        const { task_id } = await response.json();

        const eventSource = new EventSource(`http://127.0.0.1:5000/progress/${task_id}`);

        eventSource.onmessage = (event) => {
          progressBar.style.width = `${event.data}%`;
        };

        eventSource.addEventListener("image_ready", (event) => {
          const data = JSON.parse(event.data);
          displayImageFullscreen(`http://127.0.0.1:5000/saves/${data.path}`, data.prompt);
          loadHistory();
          progressWrapper.style.display = "none";
          eventSource.close();
          isGenerating = false;
        });

        eventSource.addEventListener("error", () => {
          alert("Erro na geração!");
          progressWrapper.style.display = "none";
          eventSource.close();
          isGenerating = false;
        });
      } catch (error) {
        console.error("Erro:", error);
        alert(`Falha: ${error.message}`);
        isGenerating = false;
      }
    });
  }
}

function loadHistory() {
  fetch('http://127.0.0.1:5000/api/history')
    .then(response => response.json())
    .then(images => {
      const historyList = document.getElementById('history-list');
      if (!historyList) return;
      historyList.innerHTML = "";

      images.forEach(image => {
        const li = document.createElement('li');
        const img = document.createElement('img');
        img.src = `http://127.0.0.1:5000/saves/${image.filename}`;
        img.classList.add('history-image');
        img.alt = image.prompt;

        img.addEventListener('click', () =>
          displayImageFullscreen(img.src, image.prompt)
        );

        img.addEventListener('error', () => {
          console.error('Erro ao carregar imagem:', img.src);
          alert('Imagem não pôde ser carregada');
        });

        li.appendChild(img);
        historyList.appendChild(li);
      });
    })
    .catch(error => {
      console.error("Erro ao carregar histórico:", error);
    });
}

function displayImageFullscreen(imageUrl, prompt) {
  const container = document.createElement('div');
  container.className = 'fullscreen-image';

  container.innerHTML = `
    <button class="close-button">×</button>
    <img class="fullscreen-img" src="${imageUrl}" alt="${prompt}">
    <a class="save-button" href="${imageUrl}" download="${prompt}.png">Salvar</a>
  `;

  document.body.appendChild(container);
  container.querySelector('.close-button').addEventListener('click', () =>
    container.remove()
  );
}

// Menu lateral
document.getElementById('history-icon')?.addEventListener('click', (e) => {
  e.stopPropagation();
  const historyMenu = document.getElementById('history-menu');
  historyMenu.style.display = 'block';
  setTimeout(() => historyMenu.classList.add('active'), 10);
  loadHistory();
});

document.querySelector('.close-menu')?.addEventListener('click', () => {
  const historyMenu = document.getElementById('history-menu');
  historyMenu.classList.remove('active');
  setTimeout(() => historyMenu.style.display = 'none', 300);
});

window.addEventListener('click', (e) => {
  const historyMenu = document.getElementById('history-menu');
  const historyIcon = document.getElementById('history-icon');

  if (!historyMenu?.contains(e.target) && !historyIcon?.contains(e.target)) {
    historyMenu.classList.remove('active');
    setTimeout(() => historyMenu.style.display = 'none', 300);
  }
});