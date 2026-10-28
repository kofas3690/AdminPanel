import psutil
from fastapi import Depends, FastAPI
from fastapi.staticfiles import StaticFiles
from auth import router as auth_router, current_user
from fs import router as fs_router
from system import router as system_router
from units import router as units_router
from services import router as services_router
from logs import router as logs_router
from updates import router as updates_router
from firewall import router as firewall_router
from users import router as users_router
from terminal import router as terminal_router
from storage import router as storage_router
from files import router as files_router
from network import router as network_router

app = FastAPI()

class NoCacheStatic(StaticFiles):
    """Always revalidate pages, so a deploy shows up straight away."""

    async def get_response(self, path, scope):
        r = await super().get_response(path, scope)
        r.headers["Cache-Control"] = "no-cache"
        return r

app.include_router(auth_router)
app.include_router(fs_router)
app.include_router(system_router)
app.include_router(units_router)
app.include_router(services_router)
app.include_router(logs_router)
app.include_router(updates_router)
app.include_router(firewall_router)
app.include_router(users_router)
app.include_router(terminal_router)
app.include_router(storage_router)
app.include_router(files_router)
app.include_router(network_router)


@app.get("/api/stats")
def stats(user: str = Depends(current_user)):
    return {
        "cpu": psutil.cpu_percent(interval=0.5),
        "mem": psutil.virtual_memory().percent,
        "disk": psutil.disk_usage("/").percent,
    }


app.mount("/", NoCacheStatic(directory="static", html=True), name="static")
