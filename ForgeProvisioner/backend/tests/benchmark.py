import threading
import time
import requests
import os
import psutil
import sys

BASE_URL = os.getenv("FORGE_URL", "http://localhost:8080")
CONCURRENCY = 50
ITERATIONS = 10

def worker(results, index):
    times = []
    for _ in range(ITERATIONS):
        start = time.time()
        try:
            res = requests.get(f"{BASE_URL}/api/status")
            if res.status_code == 200:
                times.append(time.time() - start)
        except Exception:
            pass
    results[index] = times

def get_process_by_port(port):
    for conn in psutil.net_connections():
        if conn.laddr.port == port and conn.status == "LISTEN":
            try:
                return psutil.Process(conn.pid)
            except psutil.NoSuchProcess:
                pass
    return None

def main():
    print(f"--- Benchmark ForgeOS API ({BASE_URL}) ---")
    proc = get_process_by_port(8080)
    
    if proc:
        print(f"Process serving on 8080: {proc.name()} (PID: {proc.pid})")
        try:
            mem_info = proc.memory_info()
            print(f"Memory (RSS) before benchmark: {mem_info.rss / 1024 / 1024:.2f} MB")
        except Exception as e:
            print(f"Could not read memory: {e}")
    else:
        print("No process found listening on port 8080. Make sure the backend is running.")

    print(f"\nStarting concurrency test: {CONCURRENCY} threads, {ITERATIONS} requests each...")
    threads = []
    results = [[] for _ in range(CONCURRENCY)]
    
    start_time = time.time()
    for i in range(CONCURRENCY):
        t = threading.Thread(target=worker, args=(results, i))
        threads.append(t)
        t.start()
        
    for t in threads:
        t.join()
        
    total_time = time.time() - start_time
    all_times = [t for sublist in results for t in sublist]
    
    success_count = len(all_times)
    total_requests = CONCURRENCY * ITERATIONS
    
    if success_count > 0:
        avg_time = sum(all_times) / success_count
        print(f"\nResults:")
        print(f"Total time: {total_time:.2f}s")
        print(f"Successful requests: {success_count}/{total_requests}")
        print(f"Avg Response Time: {avg_time*1000:.2f}ms")
        print(f"Requests/sec: {success_count / total_time:.2f}")
    else:
        print("\nAll requests failed. Is the server running?")
        
    if proc:
        try:
            mem_info = proc.memory_info()
            print(f"\nMemory (RSS) after benchmark: {mem_info.rss / 1024 / 1024:.2f} MB")
            print(f"CPU times: {proc.cpu_times()}")
        except Exception:
            pass

if __name__ == "__main__":
    main()
