import httpx
url = 'http://localhost:8000/chat'
headers = {'Origin': 'http://localhost:5173'}
with httpx.Client(headers=headers) as client:
    opt = client.options(url, timeout=5.0)
    print('OPTIONS', opt.status_code)
    print(dict(opt.headers))
    post = client.post(url, json={'message': 'test', 'history': []}, timeout=5.0)
    print('POST', post.status_code)
    print(dict(post.headers))
    print(post.text)
