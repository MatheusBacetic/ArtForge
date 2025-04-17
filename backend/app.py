from flask import Flask, request, jsonify, send_from_directory, Response
from diffusers import DiffusionPipeline
import torch
import os
import json
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
    "stabilityai/sdxl-turbo",
    torch_dtype=torch.float16
).to(device)

pipe.enable_attention_slicing()
pipe.enable_vae_slicing()

tasks = {}

# Classe de callback para progresso
class ProgressCallback:
    def __init__(self, task_id):
        self.task_id = task_id

    def __call__(self, pipe, step, timestep, callback_kwargs):
        total_steps = tasks[self.task_id]['total_steps']
        current_step = step.item() if hasattr(step, 'item') else step
        progress = ((current_step + 1) / total_steps) * 100
        progress = min(progress, 100)
        tasks[self.task_id]['progress'] = round(progress, 1)
        print(f"Tarefa {self.task_id}: Progresso {progress:.1f}%")
        return callback_kwargs

# Rota para iniciar a geração
@app.route("/start_generation", methods=["POST"], endpoint="start_generation_route")  # Renomeie o endpoint
def start_generation_route():  # Renomeie a função
    data = request.get_json()
    prompt = data.get("prompt")
    quality = data.get("quality", "medium")

    if not prompt:
        return jsonify({"error": "Prompt obrigatório"}), 400
    if quality not in {"low", "medium", "high"}:
        return jsonify({"error": "Qualidade inválida"}), 400

    task_id = str(int(time.time() * 1000))
    if task_id in tasks:
        return jsonify({"error": "Tarefa já em andamento"}), 400

    params = {
        "low": {"steps": 30, "guidance": 7.0, "size": 512},
        "medium": {"steps": 50, "guidance": 8.5, "size": 768},
        "high": {"steps": 80, "guidance": 10.0, "size": 1024}
    }[quality]

    tasks[task_id] = {
        'progress': 0,
        'image_path': None,
        'error': None,
        'quality': quality,
        'total_steps': params["steps"]
    }

    # Corrija os argumentos da thread (adicionando `params`)
    Thread(target=generate_image, args=(prompt, task_id, params)).start()
    return jsonify({"task_id": task_id}), 202

# Função de geração de imagem (fora do Flask)
def generate_image(prompt, task_id, params):  # Adicione `params` como argumento
    try:
        result = pipe(
            prompt,
            num_inference_steps=params["steps"],
            guidance_scale=params["guidance"],
            height=params["size"],
            width=params["size"],
            callback_on_step_end=ProgressCallback(task_id)
        )

        image = result.images[0] if hasattr(result, "images") else pipe.numpy_to_pil(result)[0]
        
        save_dir = os.path.join(os.getcwd(), "saves")
        os.makedirs(save_dir, exist_ok=True)
        
        sanitized_prompt = re.sub(r'[^a-zA-Z0-9]', '_', prompt)[:50]
        filename = f"{sanitized_prompt}_{int(time.time())}.png"
        save_path = os.path.join(save_dir, filename)
        image.save(save_path)
        
        tasks[task_id].update({
            "image_path": filename,
            "prompt": prompt
        })
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