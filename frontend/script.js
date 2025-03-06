document.addEventListener("DOMContentLoaded", () => {
  const introScreen = document.getElementById("intro-screen");
  const logoIntro = document.getElementById("logo-intro");

  // Adiciona a animação inicial
  logoIntro.classList.add("pulse-in");

  try {
    // Função que exibe o conteúdo principal após animação
    function showIntroAndMainContent() {
      const logoIntro = document.getElementById("logo-intro");
      const introScreen = document.getElementById("intro-screen");
      const mainContent = document.getElementById("main-content");
      const header = document.querySelector(".header");

      // Aplica a animação de fade-out na intro
      logoIntro.classList.add("fall-out");

      // Após 1 segundo, oculta a intro e exibe o conteúdo principal
      setTimeout(() => {
        // Oculta a tela intro
        introScreen.style.display = "none";
        
        // Exibe o conteúdo principal
        header.classList.add("visible"); // Anima o header
        if (mainContent) {
          mainContent.style.display = "flex";
          mainContent.classList.add("fade-in");
        }

        // Inicializa o aplicativo
        initApp();
      }, 1000); // 1000ms é o tempo da animação de fade-out da logo
    }

    // Inicia a tela intro e chama a função para exibir o conteúdo principal após o tempo
    setTimeout(showIntroAndMainContent, 4000); // Espera 4 segundos para mostrar a tela principal

    function initApp() {
      console.log("Iniciando aplicação...");

      // Alterna entre as seções "Text to Image" e "Image to Image"
      const btnTextToImage = document.getElementById("btn-text-to-image");
      const btnImageToImage = document.getElementById("btn-image-to-image");
      const textToImageSection = document.getElementById("text-to-image-section");
      const imageToImageSection = document.getElementById("image-to-image-section");

      if (btnTextToImage && btnImageToImage) {
        btnTextToImage.addEventListener("click", () => {
          textToImageSection.style.display = "block";
          imageToImageSection.style.display = "none";
        });

        btnImageToImage.addEventListener("click", () => {
          textToImageSection.style.display = "none";
          imageToImageSection.style.display = "block";
        });
      }

      // Geração de imagem a partir de texto (Text to Image)
      const generateImageBtn = document.getElementById("generate-button");
      if (generateImageBtn) {
        generateImageBtn.addEventListener("click", async () => {
          const prompt = document.getElementById("description-input")?.value.trim();
          if (!prompt) {
            alert("Por favor, forneça um prompt.");
            return;
          }

          const quality = document.getElementById("quality-select")?.value;
          try {
            const response = await fetch("http://127.0.0.1:5000/generate", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ prompt, quality }),
            });

            if (!response.ok) throw new Error("Erro ao gerar imagem.");
            const blob = await response.blob();
            const imgUrl = URL.createObjectURL(blob);
            const imgElement = document.getElementById("generated-image");

            if (imgElement) {
              imgElement.src = imgUrl;
              imgElement.style.display = "block";
            }
          } catch (error) {
            console.error("Erro:", error);
            alert("Erro ao tentar gerar a imagem.");
          }
        });
      }

      // Geração de imagem modificada (Image to Image)
      const generateModifiedImageBtn = document.getElementById("generate-modified-image-btn");
      if (generateModifiedImageBtn) {
        generateModifiedImageBtn.addEventListener("click", async () => {
          const prompt = document.getElementById("image-to-image-prompt")?.value.trim();
          const imageFile = document.getElementById("image-input")?.files[0];

          if (!prompt || !imageFile) {
            alert("Por favor, forneça um prompt e uma imagem.");
            return;
          }

          const formData = new FormData();
          formData.append("image", imageFile);
          formData.append("prompt", prompt);

          try {
            const response = await fetch("http://127.0.0.1:5000/image_to_image", {
              method: "POST",
              body: formData,
            });

            if (!response.ok) throw new Error("Erro ao processar imagem.");
            const blob = await response.blob();
            const imgUrl = URL.createObjectURL(blob);
            const imgElement = document.getElementById("modified-image");

            if (imgElement) {
              imgElement.src = imgUrl;
              imgElement.style.display = "block";
            }
          } catch (error) {
            console.error("Erro:", error);
            alert("Erro ao tentar processar a imagem.");
          }
        });
      }

      // Atualiza o nome do arquivo selecionado na seção Image to Image
      const fileInput = document.getElementById("image-input");
      const fileNameDisplay = document.getElementById("file-name");

      if (fileInput) {
        fileInput.addEventListener("change", () => {
          if (fileInput.files.length > 0) {
            fileNameDisplay.textContent = fileInput.files[0].name;
          } else {
            fileNameDisplay.textContent = "Nenhum arquivo selecionado";
          }
        });
      }
    }
  } catch (error) {
    console.error("Erro ao inicializar o script:", error);
  }

    // Seleciona o hamburger e o menu
    const hamburger = document.getElementById("hamburger");
    const menuContainer = document.getElementById("menu-container");
  
    // Função para alternar o menu
    function toggleMenu() {
      menuContainer.classList.toggle("active");
      // Animação do hamburger (transforma em "X")
      hamburger.classList.toggle("active");
    }
  
    // Adiciona evento de clique ao hamburger
    hamburger.addEventListener("click", toggleMenu);
  
    // Fecha o menu quando um botão é clicado
    const menuButtons = document.querySelectorAll(".menu-btn");
    menuButtons.forEach(button => {
      button.addEventListener("click", () => {
        menuContainer.classList.remove("active");
        hamburger.classList.remove("active");
      });
    });
});
