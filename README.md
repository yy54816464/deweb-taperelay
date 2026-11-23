# deweb-taperelay

TapeRelay storage layer for DeWEB cloud sync. Uses only the public npm clients:

- @taperelay/client
- @tapestore/client

Developer key is read only from `TAPERELAY_KEY` via `--env-file`; it is never printed or committed.

## Verified

```powershell
node --env-file=./.env scripts/verify-files.mjs
```

- Public file upload/read/delete
- SHA-256 match
- Delete succeeded on all test relay nodes

```powershell
$env:DEWEB_SYNC_PASSWORD="..."   # local test only
$env:DEWEB_ADDRESS="0x..."       # wallet address used for key derivation
node --env-file=./.env scripts/verify-encrypted.mjs
```

- 1 MiB encrypted file via `planEncryptedFile` + `uploadToServers`
- Read back via `readEncryptedFile`
- SHA-256 match; delete succeeded on all test relay nodes

## Key model

- Public files: `store.upload`.
- Confidential files: X25519 file key derived from the existing cloud-sync password and wallet address with PBKDF2-SHA256; `planEncryptedFile` seals the file key to that public key. The password is never stored or uploaded.
- Reading requires the same password/address pair.

## Test circuit safety

Use an isolated test circuit for upload/read/delete tests. Do not list or delete
unknown objects from a shared or production circuit; website files may share the
same circuit.

## Pilot results (2026-11-20)

- Circuit: `<test-circuit>`
- Nodes: test relay nodes
- Public 64 KiB: upload 2.5s, read 3.0s, SHA-256 match, deleted
- Encrypted 1 MiB: upload 2.9s, read 4.8s, SHA-256 match, deleted
- Encrypted 25 MiB: upload 25.6s, read 91.9s, SHA-256 match, deleted

Warning: 25 MiB read took ~92s in this environment. Do not use 25 MiB for
blocking UI; profile-sized objects are fine, wallpapers need
streaming/background or a smaller per-file cap.
