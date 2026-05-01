Set-Location $PSScriptRoot
C:/Users/thilak.l/AppData/Local/Programs/Python/Python314/python.exe -m pip install -r requirements.txt
C:/Users/thilak.l/AppData/Local/Programs/Python/Python314/python.exe -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8080
