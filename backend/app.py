from flask import Flask, request, jsonify, send_from_directory, Response
from diffusers import DiffusionPipeline
import torch
import os
import json
import tempfile
import re
import time
from threading import Thread
from PIL import Image

from flask_cors import CORS

app = Flask(__name__, static_folder="frontend")
CORS(app)
app.config['SECRET_KEY'] = 'secret!'

device = "cuda" if torch.cuda.is_available() else "cpu"

pipe = DiffusionPipeline.from_pretrained(
    "johnslegers/epic-diffusion", 
    torch_dtype=torch.float16
).to(device)

pipe.enable_attention_slicing()  # Reduz o uso de memória

tasks = {}

@app.after_request
def set_csp(response):
    response.headers['Content-Security-Policy'] = "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:;"
    return response

class ProgressCallback:
    def __init__(self, task_id):
        self.task_id = task_id

    def __call__(self, pipe, step, timestep, callback_kwargs):
        """Callback chamado a cada passo da inferência."""
        total_steps = callback_kwargs.get("total_timesteps", 50)
        progress = min((step + 1) / total_steps * 100, 100)
        tasks[self.task_id]['progress'] = progress
        print(f"Progresso: {progress:.1f}%")
        return callback_kwargs

def generation_callback(step, total_steps, task_id):
    """Atualiza a variável de progresso e imprime no terminal."""
    progress = min((step + 1) / total_steps * 100, 100)
    tasks[task_id]['progress'] = progress
    print(f"Progresso: {progress:.1f}%")

def generate_image(prompt, task_id):
    """Gera uma imagem real usando o StableDiffusionPipeline."""
    try:
        # Define o número de passos de inferência com base na qualidade
        quality_steps = {"low": 25, "medium": 50, "high": 75}
        steps = quality_steps.get(tasks[task_id].get("quality", "medium"), 50)

        # Cria o callback para atualizar o progresso
        callback = ProgressCallback(task_id)

        print(f"Gerando imagem para o prompt: {prompt}")
        result = pipe(
            prompt,
            num_inference_steps=steps,
            guidance_scale=7.5,
            callback_on_step_end=callback,
            height=512,  # ou menor para economizar memória
            width=512
        )

        # Verifica se a saída já está convertida para PIL
        if hasattr(result, "images") and result.images is not None:
            image = result.images[0]
        else:
            # Converte manualmente se necessário
            image = pipe.numpy_to_pil(result)[0]

        # Define o diretório de salvamento
        save_dir = os.path.join(os.getcwd(), "saves")  # Usa o caminho absoluto para a pasta 'saves'
        os.makedirs(save_dir, exist_ok=True)  # Cria o diretório, se não existir

        # Define o caminho do arquivo
        save_path = os.path.join(save_dir, f"{task_id}.png")

         # Gera um nome de arquivo único baseado no prompt + timestamp
        sanitized_prompt = re.sub(r'[^a-zA-Z0-9]', '_', prompt)[:50]
        timestamp = int(time.time())
        filename = f"{sanitized_prompt}_{timestamp}.png"
        save_path = os.path.join(save_dir, filename)
        image.save(save_path)

        # Armazena o prompt e o caminho da imagem
        tasks[task_id]['image_path'] = filename
        tasks[task_id]['prompt'] = prompt  # Salva o prompt original
        print(f"Imagem gerada: {save_path}")
    except Exception as e:
        tasks[task_id]['error'] = str(e)
        print(f"Erro ao gerar imagem: {e}")


@app.route("/")
def serve_index():
    return send_from_directory(app.static_folder, "index.html")

@app.route("/<path:path>")
def serve_static_files(path):
    return send_from_directory(app.static_folder, path)

@app.route("/start_generation", methods=["POST"])
def start_generation():
    data = request.get_json()
    prompt = data.get("prompt")
    quality = data.get("quality", "medium")

    if not prompt:
        return jsonify({"error": "Prompt obrigatório"}), 400
    if quality not in {"low", "medium", "high"}:
        return jsonify({"error": "Qualidade inválida"}), 400

    task_id = str(int(time.time() * 1000))
    if task_id in tasks:
        print(f"Tarefa já existente: {task_id}")
        return jsonify({"error": "Tarefa já em andamento"}), 400

    print(f"Nova tarefa iniciada: {task_id}")  # Log para verificar múltiplas tarefas
    tasks[task_id] = {
        'progress': 0,
        'image_path': None,
        'error': None,
        'quality': quality  # Armazena a qualidade selecionada
    }

    thread = Thread(target=generate_image, args=(prompt, task_id))
    thread.start()

    return jsonify({"task_id": task_id}), 202

@app.route("/progress/<task_id>")
def progress(task_id):
    def generate_and_stream():
        while True:
            task = tasks.get(task_id)
            if task is None:
                yield "event: error\ndata: Tarefa não encontrada.\n\n"
                break
            if task['error']:
                yield f"event: error\ndata: {task['error']}\n\n"
                break
            if task['image_path']:
                yield f"event: image_ready\ndata: {json.dumps({'path': task['image_path'], 'prompt': task['prompt']})}\n\n"
                break
            yield f"data: {task['progress']}\n\n"
            time.sleep(1)

    return Response(generate_and_stream(), content_type="text/event-stream")

@app.route('/saves/<path:filename>')
def serve_saved_image(filename):
    save_dir = os.path.join(os.getcwd(), "saves")
    file_path = os.path.join(save_dir, filename)
    
    if not os.path.exists(file_path):
        return "Imagem não encontrada", 404
    
    return send_from_directory(save_dir, filename)


# Adicione uma nova rota para listar imagens salvas
@app.route('/api/history', methods=['GET'])
def get_history():
    save_dir = os.path.join(os.getcwd(), "saves")
    if not os.path.exists(save_dir):
        return jsonify([])
    
    # Lista imagens diretamente do diretório (independente do estado do `tasks`)
    images = []
    for filename in os.listdir(save_dir):
        if filename.endswith('.png'):
            # Extrai o prompt do nome do arquivo (seguindo o formato "prompt_timestamp.png")
            prompt_part = filename.rsplit('_', 1)[0].replace('_', ' ')
            images.append({
                'filename': filename,
                'prompt': prompt_part
            })
    
    # Ordena por data de modificação
    images.sort(key=lambda x: os.path.getmtime(os.path.join(save_dir, x['filename'])), reverse=True)
    return jsonify(images)

# Adicione esta rota junto às outras rotas do Flask
@app.route('/api/delete/<filename>', methods=['DELETE'])
def delete_image(filename):
    try:
        save_dir = os.path.join(os.getcwd(), "saves")
        file_path = os.path.join(save_dir, filename)
        if os.path.exists(file_path):
            os.remove(file_path)
            return jsonify({"status": "success"})
        else:
            return jsonify({"status": "error", "message": "Arquivo não encontrado"}), 404
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=False)