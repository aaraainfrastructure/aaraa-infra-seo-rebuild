import os
import shutil

WEB_ROOT = os.getcwd()

UNUSED_LIST = os.path.join(
    WEB_ROOT,
    "audit_report",
    "unused_assets.txt"
)

QUARANTINE = os.path.join(
    WEB_ROOT,
    "_quarantine"
)

if not os.path.exists(UNUSED_LIST):
    print("unused_assets.txt not found")
    exit()

moved = 0
failed = 0

with open(
    UNUSED_LIST,
    "r",
    encoding="utf-8"
) as f:

    files = [line.strip() for line in f if line.strip()]

for src in files:

    try:

        if not os.path.exists(src):
            continue

        rel_path = os.path.relpath(
            src,
            WEB_ROOT
        )

        dest = os.path.join(
            QUARANTINE,
            rel_path
        )

        os.makedirs(
            os.path.dirname(dest),
            exist_ok=True
        )

        shutil.move(src, dest)

        moved += 1

        print(f"MOVED: {rel_path}")

    except Exception as e:

        failed += 1

        print(f"FAILED: {src}")
        print(e)

print("\n================================")
print(f"Moved  : {moved}")
print(f"Failed : {failed}")
print(f"Target : {QUARANTINE}")
print("================================")