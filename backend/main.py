# Frontend için API
from flask import Flask, request, jsonify
from flask_cors import CORS
import pandas as pd
import os
from urllib.parse import urlparse, parse_qs
import re
import time
from langdetect import detect
import requests
from youtube_transcript_api import YouTubeTranscriptApi
from googleapiclient.discovery import build
from dotenv import load_dotenv  # .env okumak için

# 1. Çevresel değişkenleri yükle (.env)
load_dotenv()

app = Flask(__name__)
CORS(app)  # Frontend (5173) ile Backend (5000) konuşabilsin diye

# API Anahtarlarını .env'den al
YOUTUBE_API_KEY = os.getenv("YOUTUBE_API_KEY")
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")

if not YOUTUBE_API_KEY or not OPENROUTER_API_KEY:
    print("UYARI: API Key'ler bulunamadı! Lütfen backend klasöründeki .env dosyasını kontrol edin.")

youtube_api = build("youtube", "v3", developerKey=YOUTUBE_API_KEY)
ytt_api = YouTubeTranscriptApi()

# Global progress tracking (İlerleme durumu)
progress_data = {
    "status": "idle",
    "current_video": None,
    "results": []
}

# --- Yardımcı Fonksiyonlar ---

def check_caption_exists(video_id):
    """YouTube Data API ile videoda alt yazı var mı kontrol eder."""
    try:
        captions = youtube_api.captions().list(
            part="id,snippet",
            videoId=video_id
        ).execute()
        return bool(captions.get("items"))
    except Exception as e:
        print(f"[YouTube API] Caption check failed for {video_id}: {e}")
        return False

def parse_video_url_for_id(url):
    """YouTube URL'sinden Video ID'sini ayıklar."""
    parsed_url = urlparse(url)
    if parsed_url.hostname in ['www.youtube.com', 'youtube.com']:
        if parsed_url.path == '/watch':
            return parse_qs(parsed_url.query).get('v', [None])[0]
        elif parsed_url.path.startswith('/embed/'):
            return parsed_url.path.split('/embed/')[1]
    elif parsed_url.hostname == 'youtu.be':
        return parsed_url.path[1:]
    return None

def summarize_text_with_ai(text, ai_model="mistral"):
    """
    OpenRouter API kullanarak özetleme yapar.
    Retry (Yeniden Deneme) ve Fallback mekanizması içerir.
    """
    # Metni temizle (zaman damgalarını kaldır)
    text_clean = re.sub(r"\[\d+:\d+\]\s*", "", text) # [01:25] formatını temizle
    text_clean = re.sub(r"\[\d+\.\d+\]\s*", "", text_clean) # Eski formatı temizle
    
    try:
        detected_lang = detect(text_clean)
    except:
        detected_lang = "en"

    # Prompt Hazırlama
    if detected_lang == "tr":
        base_prompt = "Aşağıdaki YouTube videosu transkriptini, ana noktaları kaçırmadan, akıcı ve bilgilendirici bir Türkçe paragraf olarak özetle:\n\n" + text_clean
    else:
        base_prompt = "Summarize the following YouTube video transcript into a fluent and informative paragraph in English:\n\n" + text_clean

    # --- GÜNCEL MODEL HARİTASI (Senin gönderdiğin kodlardan) ---
    model_map = {
        # Deepseek: Chimera versiyonu
        "deepseek": "tngtech/deepseek-r1t2-chimera:free",
        
        # GPT: OSS 120B versiyonu
        "gpt": "openai/gpt-oss-120b:free",
        
        # Mistral: Devstral versiyonu
        "mistral": "mistralai/devstral-2512:free",
        
        # Gemini: Flash Experience
        "gemini": "google/gemini-2.0-flash-exp:free",
        
        # Gemma: Google Gemma 3
        "gemma": "google/gemma-3-27b-it:free"
    }

    # Seçilen model ID'si (Varsayılan olarak Gemma 3 - Stabil olduğu için)
    target_model = model_map.get(ai_model, "google/gemma-3-27b-it:free")
    
    # Yedek Model (Asıl model çalışmazsa buna döner)
    fallback_model = "google/gemma-3-27b-it:free"

    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:5173",
        "X-Title": "VideoSummarizer"
    }

    # --- RETRY & FALLBACK MEKANİZMASI ---
    max_retries = 3
    
    for attempt in range(max_retries + 1):
        current_model = target_model
        
        # Son denemeyse yedek modele geç
        if attempt == max_retries:
             print(f"[AI] Asıl model yanıt vermiyor, yedek modele geçiliyor: {fallback_model}")
             current_model = fallback_model

        data = {
            "model": current_model,
            "messages": [{"role": "user", "content": base_prompt}]
        }

        print(f"[AI] İstek gönderiliyor ({attempt+1}/{max_retries+1}). Model: {current_model}")

        try:
            res = requests.post("https://openrouter.ai/api/v1/chat/completions", headers=headers, json=data)
            
            if res.status_code == 200:
                return res.json()["choices"][0]["message"]["content"]
            
            elif res.status_code == 429: # Yoğunluk hatası
                wait_time = 5 * (attempt + 1)
                print(f"[AI] Hata 429 (Yoğunluk). {wait_time} sn bekleniyor...")
                time.sleep(wait_time)
                continue
            
            elif res.status_code == 404: # Model bulunamadı hatası
                print(f"[AI] Hata 404: Model bulunamadı ({current_model}). Yedek modele geçiliyor.")
                target_model = fallback_model # Bir sonraki turda yedeği dene
                continue

            else:
                print(f"[AI] API Hatası: {res.status_code} - {res.text}")
                time.sleep(2)
                continue

        except Exception as e:
            print(f"[AI] Bağlantı hatası: {e}")
            time.sleep(2)
            continue

    return "Hata: AI modeli yanıt vermiyor. Lütfen farklı bir model seçip tekrar deneyin."

def write_transcripts(csv_path):
    """
    Videoların transkriptini çeker.
    - Bağlantı kopmalarına karşı Retry mekanizması vardır.
    - Saniyeleri Dakika:Saniye formatına çevirir.
    - Nesne/Sözlük uyumluluğu vardır.
    """
    results = []
    try:
        df = pd.read_csv(csv_path)
        if 'url' not in df.columns or df.empty:
            raise ValueError("CSV dosyasında 'url' sütunu yok")
        urls = df['url'].dropna().tolist()
    except Exception as e:
        raise RuntimeError(f"CSV okunamadı: {e}")

    # İlerlemeyi sıfırla
    progress_data["status"] = "processing"
    progress_data["results"] = []

    for idx, youtube_url in enumerate(urls, 1):
        progress_data["current_video"] = youtube_url
        
        video_id = parse_video_url_for_id(youtube_url)
        if not video_id:
            results.append({"url": youtube_url, "error": "Geçersiz URL"})
            continue

        print(f"[{idx}/{len(urls)}] İşleniyor: {video_id}")

        # --- RETRY (YENİDEN DENEME) MEKANİZMASI ---
        max_retries = 3
        success = False
        last_error = ""

        for attempt in range(max_retries):
            try:
                transcript_list = ytt_api.list(video_id)
                
                # Öncelik: Manuel -> Otomatik
                transcript = next((t for t in transcript_list if not t.is_translatable), None) or \
                             next((t for t in transcript_list if t.is_generated), None)

                if not transcript:
                    raise ValueError("Uygun transkript bulunamadı")

                t_data = transcript.fetch()
                
                lines = []
                for entry in t_data:
                    # Kütüphane sürümüne göre Dict veya Object kontrolü
                    if isinstance(entry, dict):
                        start = entry['start']
                        text = entry['text']
                    else:
                        start = entry.start
                        text = entry.text
                    
                    # --- ZAMAN FORMATI DÜZENLEMESİ (Dakika:Saniye) ---
                    minutes, seconds = divmod(int(start), 60)
                    time_str = f"{minutes:02d}:{seconds:02d}"
                    
                    lines.append(f"[{time_str}] {text}")
                
                full_text = "\n".join(lines)
                
                results.append({
                    "url": youtube_url,
                    "video_id": video_id,
                    "language": transcript.language_code,
                    "transcript": full_text
                })
                
                print(f"Transcript OK: {video_id}")
                success = True
                break # Başarılı olduysa döngüden çık

            except Exception as e:
                print(f"Deneme {attempt+1}/{max_retries} Başarısız: {e}")
                last_error = str(e)
                time.sleep(2 * (attempt + 1)) # Her hatada bekleme süresini artır

        if not success:
            results.append({"url": youtube_url, "error": f"Hata: {last_error}"})

        # Global ilerlemeyi güncelle
        progress_data["results"] = results
        time.sleep(2) # Rate limit önlemi

    progress_data["status"] = "completed"
    return results

def summarize_transcript_process(csv_path, ai_model):
    # 1. Transkriptleri çek
    transcript_results = write_transcripts(csv_path)
    
    final_results = []
    
    # 2. Hepsini özetle
    for item in transcript_results:
        if "error" in item:
            final_results.append(item)
            continue
            
        summary = summarize_text_with_ai(item["transcript"], ai_model)
        
        item["summary"] = summary
        final_results.append(item)
        
        # Anlık güncelleme
        progress_data["results"] = final_results
    
    progress_data["status"] = "completed"
    return final_results

# --- Endpointler ---

@app.route("/")
def home():
    return "Backend Çalışıyor! Frontend localhost:5173 adresinde."

@app.route("/progress")
def get_progress():
    return jsonify(progress_data)

@app.route("/transcripts", methods=["POST"])
def transcripts_endpoint():
    if 'file' not in request.files:
        return jsonify({"error": "Dosya yok"}), 400

    file = request.files['file']
    upload_folder = os.path.join(os.getcwd(), "uploads")
    os.makedirs(upload_folder, exist_ok=True)
    
    save_path = os.path.join(upload_folder, file.filename)
    file.save(save_path)

    try:
        results = write_transcripts(save_path)
        return jsonify({"status": "ok", "results": results})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/process", methods=["POST"])
def process_endpoint():
    if 'file' not in request.files:
        return jsonify({"error": "Dosya yok"}), 400

    file = request.files['file']
    upload_folder = os.path.join(os.getcwd(), "uploads")
    os.makedirs(upload_folder, exist_ok=True)
    
    save_path = os.path.join(upload_folder, file.filename)
    file.save(save_path)

    ai_model = request.form.get("aiModel", "mistral")
    
    results = summarize_transcript_process(save_path, ai_model)

    return jsonify({
        "status": "completed",
        "results": results
    })

if __name__ == "__main__":
    app.run(debug=True, port=5000)