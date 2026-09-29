// TSMCrypto — genuine SHA-256 per FIPS 180-4. Public-domain style
// implementation; no OpenSSL/CryptoPP/UE dependency so the air-gapped
// build has zero external crypto requirements.
#include "TsmSha256.h"

#include <cstring>

namespace
{

inline uint32_t RotR(uint32_t x, unsigned n) { return (x >> n) | (x << (32 - n)); }
inline uint32_t Ch(uint32_t x, uint32_t y, uint32_t z) { return (x & y) ^ (~x & z); }
inline uint32_t Maj(uint32_t x, uint32_t y, uint32_t z) { return (x & y) ^ (x & z) ^ (y & z); }
inline uint32_t BigSigma0(uint32_t x) { return RotR(x, 2) ^ RotR(x, 13) ^ RotR(x, 22); }
inline uint32_t BigSigma1(uint32_t x) { return RotR(x, 6) ^ RotR(x, 11) ^ RotR(x, 25); }
inline uint32_t SmallSigma0(uint32_t x) { return RotR(x, 7) ^ RotR(x, 18) ^ (x >> 3); }
inline uint32_t SmallSigma1(uint32_t x) { return RotR(x, 17) ^ RotR(x, 19) ^ (x >> 10); }

constexpr uint32_t K[64] = {
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
};

struct Sha256State
{
    uint32_t h[8];
    uint64_t totalBytes;
    uint8_t buffer[64];
    size_t bufferUsed;

    Sha256State()
        : h{0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
            0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19},
          totalBytes(0), bufferUsed(0)
    {
        std::memset(buffer, 0, sizeof(buffer));
    }

    void compressBlock(const uint8_t block[64])
    {
        uint32_t w[64];
        for (int i = 0; i < 16; ++i)
        {
            w[i] = (static_cast<uint32_t>(block[i * 4]) << 24) |
                   (static_cast<uint32_t>(block[i * 4 + 1]) << 16) |
                   (static_cast<uint32_t>(block[i * 4 + 2]) << 8) |
                   static_cast<uint32_t>(block[i * 4 + 3]);
        }
        for (int i = 16; i < 64; ++i)
        {
            w[i] = SmallSigma1(w[i - 2]) + w[i - 7] + SmallSigma0(w[i - 15]) + w[i - 16];
        }

        uint32_t a = h[0], b = h[1], c = h[2], d = h[3];
        uint32_t e = h[4], f = h[5], g = h[6], hh = h[7];
        for (int i = 0; i < 64; ++i)
        {
            const uint32_t t1 = hh + BigSigma1(e) + Ch(e, f, g) + K[i] + w[i];
            const uint32_t t2 = BigSigma0(a) + Maj(a, b, c);
            hh = g; g = f; f = e; e = d + t1;
            d = c; c = b; b = a; a = t1 + t2;
        }
        h[0] += a; h[1] += b; h[2] += c; h[3] += d;
        h[4] += e; h[5] += f; h[6] += g; h[7] += hh;
    }

    void update(const uint8_t* data, size_t length)
    {
        totalBytes += length;
        while (length > 0)
        {
            const size_t room = 64 - bufferUsed;
            const size_t take = length < room ? length : room;
            std::memcpy(buffer + bufferUsed, data, take);
            bufferUsed += take;
            data += take;
            length -= take;
            if (bufferUsed == 64)
            {
                compressBlock(buffer);
                bufferUsed = 0;
            }
        }
    }

    TsmSha256Digest finalize()
    {
        const uint64_t bitLength = totalBytes * 8;
        uint8_t pad = 0x80;
        update(&pad, 1);
        uint8_t zero = 0x00;
        while (bufferUsed != 56)
        {
            update(&zero, 1);
        }
        uint8_t lengthBytes[8];
        for (int i = 0; i < 8; ++i)
        {
            lengthBytes[i] = static_cast<uint8_t>(bitLength >> (56 - 8 * i));
        }
        update(lengthBytes, 8);

        TsmSha256Digest digest;
        for (int i = 0; i < 8; ++i)
        {
            digest.bytes[i * 4] = static_cast<uint8_t>(h[i] >> 24);
            digest.bytes[i * 4 + 1] = static_cast<uint8_t>(h[i] >> 16);
            digest.bytes[i * 4 + 2] = static_cast<uint8_t>(h[i] >> 8);
            digest.bytes[i * 4 + 3] = static_cast<uint8_t>(h[i]);
        }
        return digest;
    }
};

} // namespace

TsmSha256Digest TsmComputeSha256(const uint8_t* data, size_t length)
{
    Sha256State state;
    if (length > 0 && data != nullptr)
    {
        state.update(data, length);
    }
    return state.finalize();
}

std::string TsmSha256Hex(const TsmSha256Digest& digest)
{
    static const char* kHex = "0123456789abcdef";
    std::string out;
    out.reserve(64);
    for (uint8_t byte : digest.bytes)
    {
        out.push_back(kHex[byte >> 4]);
        out.push_back(kHex[byte & 0x0f]);
    }
    return out;
}

std::string TsmSha256HexOfString(const char* utf8, size_t length)
{
    const auto* bytes = reinterpret_cast<const uint8_t*>(utf8);
    return TsmSha256Hex(TsmComputeSha256(bytes, length));
}
