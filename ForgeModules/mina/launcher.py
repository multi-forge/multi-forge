#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Multi-Forge Module Launcher for Mina (Assistente Virtual Acadêmica)
Coordinates startup between GUI (main_gui.py) and CLI modes,
respecting configured execution parameters.
"""

import os
import sys
import subprocess
from pathlib import Path

def find_mina_root() -> Path:
    candidates = [
        Path(__file__).resolve().parent,
        Path("C:/Users/Aluno/.gemini/antigravity/scratch/Mina-a-Assistente-Virtual"),
        Path("/opt/mina"),
        Path("/opt/multiforge/modules/mina"),
        Path(__file__).resolve().parents[2] / "ForgeModules" / "totem",
    ]
    for p in candidates:
        if (p / "main_gui.py").is_file():
            return p
    # Fallback to current directory
    return Path.cwd()

def find_python(mina_root: Path) -> str:
    venv_python_win = mina_root / ".venv" / "Scripts" / "python.exe"
    if venv_python_win.is_file():
        return str(venv_python_win)
    venv_python_nix = mina_root / ".venv" / "bin" / "python"
    if venv_python_nix.is_file():
        return str(venv_python_nix)
    return sys.executable

def main():
    mina_root = find_mina_root()
    py_exec = find_python(mina_root)
    args = sys.argv[1:]
    
    # Mode selection
    if "--cli" in args:
        args.remove("--cli")
        target_script = mina_root / "main_cli.py"
    else:
        target_script = mina_root / "main_gui.py"
    
    if not target_script.is_file():
        print(f"[ERROR] Target script not found: {target_script}", file=sys.stderr)
        sys.exit(1)
        
    cmd = [py_exec, str(target_script)] + args
    print(f"[Multi-Forge] Launching Mina module: {' '.join(cmd)}")
    sys.stdout.flush()
    
    # Execute script within its root directory
    env = os.environ.copy()
    env["PYTHONPATH"] = str(mina_root) + os.pathsep + env.get("PYTHONPATH", "")
    
    result = subprocess.run(cmd, cwd=str(mina_root), env=env)
    sys.exit(result.returncode)

if __name__ == "__main__":
    main()
