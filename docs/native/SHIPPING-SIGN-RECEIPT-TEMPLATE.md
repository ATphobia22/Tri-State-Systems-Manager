# TSM Native Shipping sign receipt (template)

Fill on the **build host** after a real Shipping cook + Authenticode sign.  
Do not commit private keys or `.pfx` files.

| Field | Value |
|-------|--------|
| Date (UTC) | |
| Operator | |
| UE version | 5.8.x |
| Git commit SHA | |
| Configuration | Shipping Win64 |
| Output path | |
| Binary SHA-256 | |
| signtool command | |
| Timestamp server | |
| `signtool verify` result | PASS / FAIL |
| Air-gapped launch smoke | PASS / FAIL / NOT RUN |
| Headed screenshot paths | |
| Notes | |

**Non-claims:** Signature proves publisher identity for the binary, not LOMA approval, PE seal, or correct flood geometry.
