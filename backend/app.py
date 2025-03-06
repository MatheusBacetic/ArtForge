from flask import Flask, render_template, request, jsonify, send_file
from transformers import pipeline
from diffusers import StableDiffusionPipeline, DiffusionPipeline
import torch
import soundfile as sf
import os
from PIL import Image
from werkzeug.utils import secure_filename

app = Flask(__name__)

os.environ["HUGGINGFACE_HUB_TOKEN"] = "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"

# 1. Load image-to-image model
# Carregar modelo de inpainting
device = "cuda" if torch.cuda.is_available() else "cpu"
image_pipe = DiffusionPipeline.from_pretrained("stabilityai/stable-diffusion-2-inpainting")
image_pipe.to(device)

# 2. Load text-to-image model (Stable Diffusion)
device = "cuda" if torch.cuda.is_available() else "cpu"
dtype = torch.float16 if device == "cuda" else torch.float32
text_to_image_pipe = StableDiffusionPipeline.from_pretrained("stabilityai/stable-diffusion-2-1", torch_dtype=dtype)
text_to_image_pipe.to(device)


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/generate", methods=["POST"])
def generate_image():
    data = request.get_json()
    prompt = data.get("prompt", "").strip()
    quality = data.get("quality", "medium")  # Default to medium quality

    if not prompt:
        return jsonify({"error": "Prompt not provided"}), 400

    num_inference_steps = 50
    if quality == "low":
        num_inference_steps = 25
    elif quality == "high":
        num_inference_steps = 75

    try:
        print(f"Generating image with {num_inference_steps} steps...")
        image = text_to_image_pipe(prompt, num_inference_steps=num_inference_steps).images[0]
        output_path = "output.png"
        image.save(output_path)
        print(f"Image generated and saved at: {output_path}")
        return send_file(output_path, mimetype="image/png")
    except Exception as e:
        print(f"Error generating image: {e}")
        return jsonify({"error": f"Error generating image: {e}"}), 500



    
# Criar diretório para salvar uploads se não existir
UPLOAD_FOLDER = "uploads"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

@app.route("/image_to_image", methods=["POST"])
def image_to_image():
    if "image" not in request.files:
        return jsonify({"error": "Nenhuma imagem enviada"}), 400

    image_file = request.files["image"]
    prompt = request.form.get("prompt", "").strip()

    if not prompt:
        return jsonify({"error": "Prompt é obrigatório"}), 400

    # Salvar imagem temporariamente
    filename = secure_filename(image_file.filename)
    image_path = os.path.join(UPLOAD_FOLDER, filename)
    image_file.save(image_path)

    try:
        print("Abrindo imagem...")
        original_image = Image.open(image_path).convert("RGB")
        print("Imagem carregada com sucesso!")

        # Criar uma máscara branca do mesmo tamanho da imagem
        mask = Image.new("L", original_image.size, 255)  # Branco = Sem edição

        print("Gerando imagem com o modelo...")
        output = image_pipe(prompt=prompt, image=original_image, mask_image=mask).images[0]
        print("Imagem gerada com sucesso!")

        output_path = "output_image.png"
        output.save(output_path)
        print(f"Imagem salva em: {output_path}")

    except Exception as e:
        import traceback
        print(traceback.format_exc())  # Mostra erro completo no terminal
        return jsonify({"error": f"Erro ao processar a imagem: {e}"}), 500

    return send_file(output_path, mimetype="image/png")
    
if __name__ == "__main__":
    app.run(port=5000, debug=True) 