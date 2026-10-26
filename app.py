import psutil
from fastapi import Depends, FastAPI
from fastapi.staticfiles import StaticFiles
from auth import router as auth_router, current_user
from services import router as services_router
from logs import router as logs_router
from updates import router as updates_router
from firewall import router as firewall_router
from users import router as users_router

app = FastAPI()
app.include_router(auth_router)
app.include_router(services_router)
app.include_router(logs_router)
app.include_router(updates_router)
app.include_router(firewall_router)
app.include_router(users_router)


@app.get("/api/stats")
def stats(user: str = Depends(current_user)):
    return {
        "cpu": psutil.cpu_percent(interval=0.5),
        "mem": psutil.virtual_memory().percent,
        "disk": psutil.disk_usage("/").percent,
    }


app.mount("/", StaticFiles(directory="static", html=True), name="static")
