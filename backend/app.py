from flask import Flask, request, jsonify
import json
from concurrent.futures import ThreadPoolExecutor
import queue
import pandas as pd
import os
from datetime import datetime, timedelta
import pyarrow.parquet as pq
from pyarrow import Table
import threading
CONFIG_FILE_PATH = './users_config.json'
app = Flask(__name__)
executor = ThreadPoolExecutor(5)
topics_queues = {'Themes': queue.Queue(), 'topic2': queue.Queue(),'base': queue.Queue()}
# 读取用户配置
def load_user_config():
    with open(CONFIG_FILE_PATH, 'r') as file:
        return json.load(file)
def validate_user(username):
    config = load_user_config()
    return username in config.get('valid_users', [])

@app.route('/validate_user', methods=['POST'])
def validate_user_handler():
    username = request.json.get('username')
    if not username:
        return jsonify({"error": "Username is required"}), 400
    if validate_user(username):
        return jsonify({"message": "User validated"}), 200
    else:
        return jsonify({"error": "Invalid user"}), 403
def process_data(topic, data):
    date_str = datetime.now().strftime('%Y-%m-%d')
    directory = f'./data/{topic}/{date_str}'
    filename = f'{directory}/{date_str}.json'
    os.makedirs(directory, exist_ok=True)
    
    with open(filename, 'a') as file:
        json.dump(data, file)
        file.write('\n')  

def compress_to_parquet(topic):
    yesterday_str = (datetime.now() - timedelta(days=1)).strftime('%Y-%m-%d')
    source_directory = f'./data/{topic}/{yesterday_str}'
    source_filename = f'{source_directory}/{yesterday_str}.json'
    target_filename = f'{source_directory}/{yesterday_str}.parquet'
    
    if os.path.exists(source_filename):
        df = pd.read_json(source_filename, lines=True)
        table = Table.from_pandas(df)
        pq.write_table(table, target_filename)
        os.remove(source_filename) 

def queue_worker(topic):
    while True:
        data = topics_queues[topic].get()
        process_data(topic, data)
        topics_queues[topic].task_done()

def schedule_compression():
    for topic in topics_queues.keys():
        compress_to_parquet(topic)
    # Schedule this function to run daily
    threading.Timer(86400, schedule_compression).start()

@app.route('/log', methods=['POST'])
def log_handler():
    datas = request.get_json(silent=True)  
    if not isinstance(datas, list):  
        return jsonify({"error": "Expected a list of data"}), 400

    processed_count = 0
    error_count = 0
    errors = []

    for data in datas:
        topic = data.get('topic')
        if topic in topics_queues:
            topics_queues[topic].put(data)
            processed_count += 1
        else:
            error_count += 1
            errors.append(f"Topic '{topic}' not supported")

    # Return a summary of the processing
    if error_count > 0:
        return jsonify({
            "message": f"Processed {processed_count} items, with {error_count} errors",
            "errors": errors
        }), 207  # 207 Multi-Status might be suitable here

    return jsonify({"message": f"All {processed_count} data items queued for processing"}), 202



if __name__ == '__main__':
    for topic in topics_queues.keys():
        executor.submit(queue_worker, topic)
    schedule_compression() 
    app.run(debug=True, port=5000)
