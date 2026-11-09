import psutil
from fastapi import Depends, FastAPI
from fastapi.staticfiles import StaticFiles
from auth import router as auth_router, current_user
from sshkeys import router as sshkeys_router
from userunits import router as userunits_router
from storage_admin import router as storage_admin_router
from security import router as security_router
from journal import router as journal_router
from fs import router as fs_router
from system import router as system_router
from units import router as units_router
from services import router as services_router
from remote import router as remote_router
from logs import router as logs_router
from updates import router as updates_router
from firewall import router as firewall_router
from users import router as users_router
from terminal import router as terminal_router
from storage import router as storage_router
from network import router as network_router
from fleet import router as fleet_router, health_router
from power import router as power_router
from alerts import router as alerts_router, start_watcher as alerts_start
from metrics import router as metrics_router, start as metrics_start
from hardware import router as hardware_router
from logins import router as logins_router
from backup import router as backup_router

app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)

class NoCacheStatic(StaticFiles):
    """Always revalidate pages, so a deploy shows up straight away."""

    async def get_response(self, path, scope):
        r = await super().get_response(path, scope)
        r.headers["Cache-Control"] = "no-cache"
        return r

app.include_router(auth_router)
app.include_router(sshkeys_router)
app.include_router(userunits_router)
app.include_router(storage_admin_router)
app.include_router(security_router)
app.include_router(journal_router)
app.include_router(fs_router)
app.include_router(system_router)
app.include_router(units_router)
app.include_router(services_router)
app.include_router(remote_router)
app.include_router(logs_router)
app.include_router(updates_router)
app.include_router(firewall_router)
app.include_router(users_router)
app.include_router(terminal_router)
app.include_router(storage_router)
app.include_router(network_router)
app.include_router(power_router)
app.include_router(alerts_router)
app.include_router(metrics_router)
app.include_router(hardware_router)
app.include_router(logins_router)
app.include_router(backup_router)

app.include_router(fleet_router)
app.include_router(health_router)


@app.on_event("startup")
def _start_alert_mail():
    alerts_start()
    metrics_start()


@app.get("/api/stats")
def stats(user: str = Depends(current_user)):
    return {
        "cpu": psutil.cpu_percent(interval=0.5),
        "mem": psutil.virtual_memory().percent,
        "disk": psutil.disk_usage("/").percent,
    }


app.mount("/", NoCacheStatic(directory="static", html=True), name="static")
