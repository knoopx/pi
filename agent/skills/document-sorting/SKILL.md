---
name: document-sorting
description: Organize PDFs and documents by converting to images, analyzing content, and renaming with descriptive filenames.
---

# Document Sorter Skill

Organize PDFs and documents by converting to images, analyzing content, and renaming with descriptive filenames.

## Workflow

### Step 1: Convert PDF to Image

```bash
pdftoppm -png -r 150 "path/to/document.pdf" /tmp/doc-NNN
```

- `-png`: Output format
- `-r 150`: Resolution (150 DPI for text)
- Output: Creates `doc-NNN-1.png`, `doc-NNN-2.png` for multi-page

### Step 2: Read and Analyze

```bash
read /tmp/doc-NNN-1.png
```

- View first page for single-page docs
- View all pages for multi-page docs

### Step 3: Rename

```bash
mv "original-name.pdf" "YYYY-MM-vendor-type-subject-identifier.pdf"
```

### Step 4: Continue with Next PDF

Repeat steps 1-3 for each document, one by one.

## Naming Convention

Format: `YYYY-MM-vendor-type-subject-identifier.pdf`
