#pragma once
// TSMCrypto — SHA-256 core API.
// Pure C++ (no Unreal Engine headers) so the implementation is reviewable
// and testable outside the engine. FIPS 180-4.
//
// NOTE: an earlier draft of this module hashed with FMD5::HashAnsiString
// (MD5, 128-bit) and, in a later draft, with FSHA1 (SHA-1, 160-bit) while
// labeling the result "SHA-256". Both were wrong. This module implements
// genuine SHA-256 (256-bit) per FIPS 180-4 with no external dependencies.
#include <cstddef>
#include <cstdint>
#include <string>

struct TsmSha256Digest
{
    uint8_t bytes[32];
};

// Compute the SHA-256 digest of [data, data + length).
// `data` may be nullptr only when length == 0.
TsmSha256Digest TsmComputeSha256(const uint8_t* data, size_t length);

// Lowercase hex encoding of a digest (64 chars, no prefix).
std::string TsmSha256Hex(const TsmSha256Digest& digest);

// Convenience: hash a UTF-8 byte string and return lowercase hex.
std::string TsmSha256HexOfString(const char* utf8, size_t length);
