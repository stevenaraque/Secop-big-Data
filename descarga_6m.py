"""
Descarga SECOP II 6.066.730 filas paginado $limit=50000 + $offset
Usa management command cargar_secop existente (bulk_create 1000 + RNF-04)
Reanuda desde último offset según BD. Log a archivo.
"""
import subprocess, sys, time, io
from pathlib import Path
try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')
except: pass

BASE = Path(r"C:\Users\PC_03\OneDrive\Desktop\Big data\Backend\secop_backend")
VENV_PY = BASE / "venv" / "Scripts" / "python.exe"
MANAGE = BASE / "secop_backend" / "manage.py"

TOTAL = 6066730
LIMIT = 50000
START_OFFSET = 475540  # BD actual 474820 + offset 470540+5000 paginado, reanuda aqui 25/09 08:35 fix decimales
LOG = BASE / "descarga_6m.log"

def run_page(offset):
    cmd = [str(VENV_PY), str(MANAGE), "cargar_secop", "--limit", str(LIMIT), "--offset", str(offset)]
    print(f"\n>> Offset {offset:,} / {TOTAL:,} ({offset/TOTAL*100:.1f}%)")
    t0 = time.time()
    result = subprocess.run(cmd, cwd=str(BASE), capture_output=True, text=True, encoding="utf-8", errors="replace")
    elapsed = time.time() - t0
    out = result.stdout.strip()
    err = result.stderr.strip()
    with open(LOG, "a", encoding="utf-8") as f:
        f.write(f"\n=== OFFSET {offset} elapsed {elapsed:.1f}s ===\n")
        f.write(out + "\n")
        if err:
            f.write("ERR: " + err + "\n")
    safe_out = out.encode('ascii','replace').decode('ascii')
    safe_err = err.encode('ascii','replace').decode('ascii')
    print(safe_out[-800:] if len(safe_out)>800 else safe_out)
    if safe_err:
        print("ERR:", safe_err[-500:])
    return result.returncode == 0, elapsed

if __name__ == "__main__":
    print(f"Inicio descarga 6M desde offset {START_OFFSET:,} — log {LOG}")
    # trunc log
    with open(LOG, "w", encoding="utf-8") as f:
        f.write(f"Inicio {time.strftime('%Y-%m-%d %H:%M:%S')} START {START_OFFSET}\n")
    offset = START_OFFSET
    ok_pages = 0
    t_total = time.time()
    while offset < TOTAL:
        ok, elapsed = run_page(offset)
        if not ok:
            print(f"!! Fallo offset {offset}, reintentando en 10s...")
            time.sleep(10)
            ok, _ = run_page(offset)
            if not ok:
                print(f"XX Abortado en offset {offset}. Revisa {LOG}")
                sys.exit(1)
        ok_pages += 1
        # progresión: si la página trajo 0 nuevos pero no error, igual avanzar
        offset += LIMIT
        # pausa corta para no saturar SODA sin token (1000 req/h → 3.6s min entre req)
        time.sleep(2)
        # estimación
        avg = (time.time() - t_total) / ok_pages
        restantes = (TOTAL - offset) / LIMIT
        eta_min = restantes * avg / 60
        print(f"Prom {avg:.1f}s/pag | ETA ~{eta_min:.0f} min | Paginas {ok_pages}")
    print(f"\nOK Descarga completa {ok_pages} paginas en {(time.time()-t_total)/60:.1f} min. Verifica: python manage.py shell -c \"from contratos.models import Contrato; print(Contrato.objects.count())\"")
