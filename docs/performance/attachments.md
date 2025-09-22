# Attachment Download Optimization

## Problem Solved

Attachments were systematically re-downloaded on every cache refresh, even if they already existed on disk with the same name and size. This caused:

- Time loss during refreshes
- Unnecessary bandwidth consumption
- File duplication
- Degraded system performance

## Solution Implemented

### 1. Deterministic File Naming (sqlite-backend.ts:158-183)

**Before:**
```typescript
const timestamp = Date.now();
return `${name}_${timestamp}${ext}`;
```

**After:**
```typescript
const urlHash = this.hashString(url).substring(0, 8);
return `${name}_${urlHash}${ext}`;
```

- File names are now based on URL hash
- Same file always gets the same local name
- Prevents conflicts while enabling reuse

### 2. Existence Check Before Download (sqlite-backend.ts:121-138)

```typescript
// Check if file already exists and has the correct size
const existingFile = Bun.file(localPath);
const fileExists = await existingFile.exists();

if (fileExists) {
  const existingSize = existingFile.size;
  if (existingSize === attachment.size) {
    // File already exists with correct size, just mark as downloaded
    console.log(`📎 Skipping download (file exists): ${attachment.filename}`);
    await markAttachmentDownloaded(attachment.id, localPath, attachment.size);
    downloaded++;
    continue;
  } else {
    // File exists but wrong size, delete and re-download
    console.log(
      `📎 File exists but wrong size, re-downloading: ${attachment.filename}`
    );
    await Bun.$`rm -f ${localPath}`;
  }
}
```

- Checks if file already exists
- Compares size to ensure integrity
- Skips download if file is valid
- Deletes and re-downloads if size is incorrect

### 3. Metadata Preservation During Refresh (index.ts:240-274)

```typescript
// Check for existing attachments with same URL to preserve download info
const existingStmt = db.prepare(`
  SELECT local_path, downloaded_at FROM attachments
  WHERE original_url = ? AND local_path IS NOT NULL AND downloaded_at IS NOT NULL
  LIMIT 1
`);

for (const attachment of attachments) {
  // Check if this URL already exists with download info
  const existing = existingStmt.get(attachment.original_url);

  // Verify the file still exists if we have download info
  let localPath = null;
  let downloadedAt = null;
  if (existing) {
    const localFile = Bun.file(existing.local_path);
    if (await localFile.exists()) {
      localPath = existing.local_path;
      downloadedAt = existing.downloaded_at;
    }
  }

  // Insert with preserved download info
  insertStmt.run(/* ... */, localPath, downloadedAt);
}
```

- Searches for existing attachments with same URL
- Preserves download information if file still exists
- Prevents marking already downloaded files as "pending"

## Results

### Observed Log Messages
```
📎 Skipping download (file exists): Screenshot 2024-07-06 at 17.06.06.png
📎 Skipping download (file exists): norwood-class-7-hair-transplant-4000-2.jpg
📎 Skipping download (file exists): Asmed 4541 grafts .png
```

### Benefits Achieved

1. **Improved Performance**: Refreshes are significantly faster
2. **Bandwidth Savings**: Only new attachments are downloaded
3. **Prevents Duplication**: No identical files with different names
4. **Resilience**: System verifies integrity of existing files

## Tests Implemented

- **Unit tests**: Verification of deterministic naming and hashing
- **Functional tests**: Validation of download skipping in real conditions
- **Integration tests**: Compatibility with existing system

## Architecture Impact

This optimization integrates naturally into the existing architecture:

- No public API changes
- Compatible with dual database system
- Preserves existing worker/refresh logic
- Maintains system security and reliability