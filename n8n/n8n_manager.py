import os
import sys
import json
import urllib.request
import urllib.error

# Definición de configuraciones desde entorno. 
# Si no existen, se usa el default provisto en la consola.
BASE_URL = os.environ.get("N8N_BASE_URL", "https://agentcore-n8n.8zp1cp.easypanel.host").rstrip("/")
API_KEY = os.environ.get("N8N_API_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2NzA0NzEwYy05NTNlLTQ2MzctODM5My1iN2U5OTZiZTJiN2EiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiYjU5NGEzZDEtOTc5ZC00YzYxLTkwZDEtODdhM2YxOWViODMwIiwiaWF0IjoxNzczNzc5MDc5LCJleHAiOjE3ODE0OTYwMDB9.vBqNhO8OUtF_D5NxIOMsKbPTbKmtutcA-7z64mFzuHA")

if not BASE_URL or not API_KEY:
    print("Error: Configura N8N_BASE_URL y N8N_API_KEY")
    sys.exit(1)

HEADERS = {
    "X-N8N-API-KEY": API_KEY,
    "Content-Type": "application/json",
    "Accept": "application/json"
}

def api_call(method, path, data=None):
    url = f"{BASE_URL}/api/v1{path}"
    req = urllib.request.Request(url, headers=HEADERS, method=method)
    if data:
        req.data = json.dumps(data).encode("utf-8")
    try:
        with urllib.request.urlopen(req) as response:
            return json.loads(response.read().decode())
    except urllib.error.HTTPError as e:
        print(f"Error {e.code}: {e.read().decode()}")
        sys.exit(1)

def main():
    if len(sys.argv) < 2:
        print("Usage: python n8n_manager.py <list|get|create|update|activate|deactivate|run_webhook> [args]")
        return
    
    cmd = sys.argv[1]
    
    if cmd == "list":
        print(json.dumps(api_call("GET", "/workflows"), indent=2))
        
    elif cmd == "get":
        print(json.dumps(api_call("GET", f"/workflows/{sys.argv[2]}"), indent=2))
        
    elif cmd == "create":
        with open(sys.argv[2], "r") as f: data = json.load(f)
        print("Creado ID:", api_call("POST", "/workflows", data).get("id"))
        
    elif cmd == "update":
        with open(sys.argv[3], "r") as f: data = json.load(f)
        api_call("PUT", f"/workflows/{sys.argv[2]}", data)
        print("Workflow actualizado.")
        
    elif cmd == "activate":
        wf = api_call("GET", f"/workflows/{sys.argv[2]}")
        wf["active"] = True
        api_call("PUT", f"/workflows/{sys.argv[2]}", wf)
        print("Workflow activado.")
        
    elif cmd == "deactivate":
        wf = api_call("GET", f"/workflows/{sys.argv[2]}")
        wf["active"] = False
        api_call("PUT", f"/workflows/{sys.argv[2]}", wf)
        print("Workflow desactivado.")
        
    elif cmd == "run_webhook":
        wh_url = sys.argv[2]
        payload = sys.argv[3] if len(sys.argv) > 3 else "{}"
        req = urllib.request.Request(wh_url, data=payload.encode(), method="POST")
        req.add_header("Content-Type", "application/json")
        try:
            with urllib.request.urlopen(req) as res:
                print(res.read().decode())
        except urllib.error.HTTPError as e:
            print(f"Error HTTP {e.code}: {e.read().decode()}")

if __name__ == "__main__":
    main()
