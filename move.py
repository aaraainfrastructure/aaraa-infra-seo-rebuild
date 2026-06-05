import os
import shutil

# Source project folder (current folder)
source_root = os.getcwd()

# Destination folder
destination_root = os.path.join(source_root, "to_upload")
os.makedirs(destination_root, exist_ok=True)

files_to_copy = [
    "contact-us.html",
    "vendor-registration.html",
    "vendor-form.html",
    "services.html",
    "renewables.html",
    "sectors.html",
    "team.html",
    "master_template.html",
    "on-going-projects.html",
    "interior-fitout-contracts.html",
    "mep-hvac-services.html",
    "interior-fitout.html",
    "infrastructure.html",
    "industrial.html",
    "institutional.html",
    "job-apply.html",
    "history.html",
    "general-contracting-services.html",
    "gallery.html",
    "completed-projects.html",
    "faq.html",
    "blog-details.html",
    "commercial.html",
    "civil-and-pre-engineered-buildings.html",
    "gpt.html",
    "chat.html",
    "sector_enquiry/enquiry.html"
]

for file_path in files_to_copy:
    src = os.path.join(source_root, file_path)

    if os.path.exists(src):
        dst = os.path.join(destination_root, file_path)

        # Create subfolders if required
        os.makedirs(os.path.dirname(dst), exist_ok=True)

        shutil.copy2(src, dst)
        print(f"✓ Copied: {file_path}")
    else:
        print(f"✗ Missing: {file_path}")

print(f"\nDone! Files copied to:\n{destination_root}")