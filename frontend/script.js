document.addEventListener("DOMContentLoaded", () => {
  // ANIMAÇÃO DE INTRODUÇÃO
  const introScreen = document.getElementById("intro-screen");
  const logoIntro = document.getElementById("logo-intro");
  const mainContent = document.getElementById("main-content");
  const header = document.querySelector(".header");

  logoIntro.classList.add("pulse-in");

  function showIntroAndMainContent() {
    logoIntro.classList.add("fall-out");

    setTimeout(() => {
      introScreen.style.display = "none";
      header.classList.add("visible");
      mainContent.style.display = "flex";
      mainContent.classList.add("fade-in");
      initApp(); // Inicializa funcionalidades após animação
    }, 1000);
  }

  setTimeout(showIntroAndMainContent, 4000);

  // MENU LATERAL (HISTÓRICO)
  const historyIcon = document.getElementById("history-icon");
  const historyMenu = document.getElementById("history-menu");
  const closeMenu = document.querySelector(".close-menu");

  if (historyIcon && historyMenu && closeMenu) {
    historyIcon.addEventListener("click", (e) => {
      e.stopPropagation();
      historyMenu.style.display = "block";
      setTimeout(() => historyMenu.classList.add("active"), 10);
    });

    closeMenu.addEventListener("click", () => {
      historyMenu.classList.remove("active");
      setTimeout(() => (historyMenu.style.display = "none"), 300);
    });

    window.addEventListener("click", (e) => {
      if (!historyMenu.contains(e.target) && !historyIcon.contains(e.target)) {
        historyMenu.classList.remove("active");
        setTimeout(() => (historyMenu.style.display = "none"), 300);
      }
    });
  }

  let isGenerating = false;

  // FUNCIONALIDADES PRINCIPAIS
  function initApp() {
    const btnTextToImage = document.getElementById("btn-text-to-image");
    const btnImageToImage = document.getElementById("btn-image-to-image");
    const textToImageSection = document.getElementById("text-to-image-section");
    const imageToImageSection = document.getElementById("image-to-image-section");
    const initialMenu = document.getElementById("initial-menu");

    // Navegação entre as seções
    if (btnTextToImage && btnImageToImage) {
      btnTextToImage.addEventListener("click", () => {
        textToImageSection.style.display = "block";
        imageToImageSection.style.display = "none";
        initialMenu.style.display = "none";
      });

      btnImageToImage.addEventListener("click", () => {
        textToImageSection.style.display = "none";
        imageToImageSection.style.display = "block";
        initialMenu.style.display = "none";
      });
    }

    const historyMenu = document.getElementById("history-menu");
    const historyList = historyMenu.querySelector("ul"); // Certifique-se de que o <ul> existe no HTML
  
    const generateImageBtn = document.getElementById("generate-button");
    const progressWrapper = document.querySelector(".progress-wrapper");
    const progressBar = document.getElementById("progress-bar");
  
    if (generateImageBtn) {
      generateImageBtn.addEventListener("click", async () => {
        if (isGenerating) return; // Evita múltiplas requisições
        isGenerating = true;
  
        // Mostra a barra de progresso
        progressWrapper.style.display = "block";
        progressBar.style.width = "0%";
  
        // Obtém os valores de prompt e qualidade
        const prompt = document.getElementById("description-input")?.value.trim();
        const quality = document.getElementById("quality-select")?.value;
  
        // Valida os valores
        if (!prompt) {
          alert("Por favor, forneça um prompt.");
          progressWrapper.style.display = "none";
          isGenerating = false;
          return;
        }
  
        if (!quality) {
          alert("Por favor, selecione uma qualidade.");
          progressWrapper.style.display = "none";
          isGenerating = false;
          return;
        }
  
        try {
          // Envia a requisição para iniciar a geração
          const response = await fetch("http://127.0.0.1:5000/start_generation", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompt, quality }),
          });
  
          if (!response.ok) throw new Error("Erro ao iniciar geração");
  
          const { task_id } = await response.json();
  
          // Cria um EventSource para receber atualizações de progresso e o resultado final
          const eventSource = new EventSource(`http://127.0.0.1:5000/progress/${task_id}`);
  
          eventSource.onmessage = (event) => {
            // Atualiza o progresso
            progressBar.style.width = `${event.data}%`;
            console.log(`Progresso: ${event.data}%`);
          };
  
          eventSource.addEventListener("image_ready", (event) => {
            // Adiciona a imagem gerada ao histórico
            const imgUrl = `http://127.0.0.1:5000/saves/${event.data.split('/').pop()}`; // Corrige o caminho da imagem
            const listItem = document.createElement("li");
            const imgElement = document.createElement("img");
            imgElement.src = imgUrl;
            imgElement.alt = "Imagem Gerada";
            imgElement.classList.add("history-image");
            listItem.appendChild(imgElement);
            historyList.appendChild(listItem);
  
            // Oculta a barra de progresso
            progressWrapper.style.display = "none";
            eventSource.close();
            isGenerating = false; // Libera para nova geração
          });
  
          eventSource.addEventListener("error", (event) => {
            // Lida com erros
            alert(`Erro: ${event.data}`);
            progressWrapper.style.display = "none";
            eventSource.close();
            isGenerating = false; // Libera para nova geração
          });
        } catch (error) {
          console.error("Erro:", error);
          alert(`Falha: ${error.message}`);
          progressWrapper.style.display = "none";
          isGenerating = false; // Libera para nova geração
        }
      });
    }
  }

  // Inicializa as funcionalidades principais
  initApp();
});