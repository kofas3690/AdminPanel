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
from processes import router as processes_router
from smart import router as smart_router, start as smart_start
from cron import router as cron_router
from clock import router as clock_router
from certs import router as certs_router, start as certs_start
from reboot import router as reboot_router
from kernel import router as kernel_router
from sudolog import router as sudo_router
from packages import router as packages_router
from diskusage import router as du_router
from shares import router as shares_router
from containers import router as containers_router
from blocked import router as blocked_router
from listening import router as listening_router
from startup import router as startup_router
from autoupdates import router as autoupdates_router
from swap import router as swap_router
from seccheck import router as seccheck_router
from authkeys import router as authkeys_router
from logclean import router as logclean_router
from websites import router as websites_router
from certrenew import router as certrenew_router

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
app.include_router(processes_router)
app.include_router(smart_router)
app.include_router(cron_router)
app.include_router(clock_router)
app.include_router(certs_router)
app.include_router(reboot_router)
app.include_router(kernel_router)
app.include_router(sudo_router)
app.include_router(packages_router)
app.include_router(du_router)
app.include_router(shares_router)
app.include_router(containers_router)
app.include_router(blocked_router)
app.include_router(listening_router)
app.include_router(startup_router)
app.include_router(autoupdates_router)
app.include_router(swap_router)
app.include_router(seccheck_router)
app.include_router(authkeys_router)
app.include_router(logclean_router)
app.include_router(websites_router)
app.include_router(certrenew_router)

app.include_router(fleet_router)
app.include_router(health_router)


@app.on_event("startup")
def _start_alert_mail():
    alerts_start()
    metrics_start()
    smart_start()
    certs_start()


@app.get("/api/stats")
def stats(user: str = Depends(current_user)):
    return {
        "cpu": psutil.cpu_percent(interval=0.5),
        "mem": psutil.virtual_memory().percent,
        "disk": psutil.disk_usage("/").percent,
    }


app.mount("/", NoCacheStatic(directory="static", html=True), name="static")
