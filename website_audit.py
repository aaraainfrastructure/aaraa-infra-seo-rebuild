import os
import re
from pathlib import Path

# ==========================================
# CONFIG
# ==========================================

WEB_ROOT = os.getcwd()

IGNORE_DIRS = {
    ".git",
    "node_modules",
    ".firebase",
    ".vscode",
    "__pycache__",
    "_unused_assets"
}

ASSET_EXTENSIONS = {
    ".png", ".jpg", ".jpeg", ".gif",
    ".webp", ".svg", ".ico",
    ".css", ".js",
    ".woff", ".woff2",
    ".ttf", ".eot",
    ".mp4", ".pdf"
}

SOURCE_EXTENSIONS = {
    ".html", ".htm",
    ".php",
    ".css",
    ".js"
}

# ==========================================
# COLLECT FILES
# ==========================================

all_files = []
source_files = []

for root, dirs, files in os.walk(WEB_ROOT):

    dirs[:] = [d for d in dirs if d not in IGNORE_DIRS]

    for file in files:

        full_path = os.path.join(root, file)

        all_files.append(full_path)

        if Path(file).suffix.lower() in SOURCE_EXTENSIONS:
            source_files.append(full_path)

# ==========================================
# FIND REFERENCES
# ==========================================

references = set()

patterns = [
    r'src=["\']([^"\']+)["\']',
    r'href=["\']([^"\']+)["\']',
    r'url\(["\']?([^"\')]+)',
    r'import .*?["\']([^"\']+)["\']',
    r'require\(["\']([^"\']+)["\']\)'
]

for file in source_files:

    try:
        with open(file, "r", encoding="utf-8", errors="ignore") as f:
            content = f.read()

        for pattern in patterns:

            matches = re.findall(
                pattern,
                content,
                flags=re.IGNORECASE
            )

            for match in matches:

                if (
                    match.startswith("http")
                    or match.startswith("//")
                    or match.startswith("#")
                    or match.startswith("data:")
                    or match.startswith("mailto:")
                    or match.startswith("tel:")
                ):
                    continue

                clean = os.path.basename(
                    match.split("?")[0]
                )

                references.add(clean)

    except Exception:
        pass

# ==========================================
# FIND UNUSED ASSETS
# ==========================================

unused_assets = []

for file in all_files:

    ext = Path(file).suffix.lower()

    if ext not in ASSET_EXTENSIONS:
        continue

    name = os.path.basename(file)

    if name not in references:
        unused_assets.append(file)

# ==========================================
# FIND ORPHAN HTML PAGES
# ==========================================

html_pages = []

for file in all_files:

    ext = Path(file).suffix.lower()

    if ext in {".html", ".htm", ".php"}:
        html_pages.append(file)

linked_pages = set()

for file in source_files:

    try:

        content = open(
            file,
            encoding="utf-8",
            errors="ignore"
        ).read()

        links = re.findall(
            r'href=["\']([^"\']+)["\']',
            content,
            re.IGNORECASE
        )

        for link in links:

            linked_pages.add(
                os.path.basename(
                    link.split("?")[0]
                )
            )

    except:
        pass

orphan_pages = []

for page in html_pages:

    name = os.path.basename(page)

    if name == "index.html":
        continue

    if name not in linked_pages:
        orphan_pages.append(page)

# ==========================================
# REPORTS
# ==========================================

report_dir = os.path.join(
    WEB_ROOT,
    "audit_report"
)

os.makedirs(
    report_dir,
    exist_ok=True
)

unused_report = os.path.join(
    report_dir,
    "unused_assets.txt"
)

with open(
    unused_report,
    "w",
    encoding="utf-8"
) as f:

    for item in sorted(unused_assets):
        f.write(item + "\n")

orphan_report = os.path.join(
    report_dir,
    "orphan_pages.txt"
)

with open(
    orphan_report,
    "w",
    encoding="utf-8"
) as f:

    for item in sorted(orphan_pages):
        f.write(item + "\n")

summary = os.path.join(
    report_dir,
    "summary.txt"
)

with open(
    summary,
    "w",
    encoding="utf-8"
) as f:

    f.write("WEBSITE AUDIT REPORT\n")
    f.write("====================\n\n")

    f.write(
        f"Total Files: {len(all_files)}\n"
    )

    f.write(
        f"Source Files: {len(source_files)}\n"
    )

    f.write(
        f"Unused Assets: {len(unused_assets)}\n"
    )

    f.write(
        f"Orphan Pages: {len(orphan_pages)}\n"
    )

print("\nAUDIT COMPLETE")
print(f"Files Scanned : {len(all_files)}")
print(f"Unused Assets : {len(unused_assets)}")
print(f"Orphan Pages  : {len(orphan_pages)}")
print(f"\nReport Folder : {report_dir}")