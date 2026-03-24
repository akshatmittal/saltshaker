alias u64 = vec2<u32>;

fn make_u64(low: u32, high: u32) -> u64 {
    return vec2<u32>(low, high);
}

fn xor_u64(a: u64, b: u64) -> u64 {
    return vec2<u32>(a.x ^ b.x, a.y ^ b.y);
}

fn and_u64(a: u64, b: u64) -> u64 {
    return vec2<u32>(a.x & b.x, a.y & b.y);
}

fn not_u64(a: u64) -> u64 {
    return vec2<u32>(~a.x, ~a.y);
}

fn rol_lo(x: u64, n: u32) -> u64 {
    return vec2<u32>((x.x << n) | (x.y >> (32u - n)), (x.y << n) | (x.x >> (32u - n)));
}

fn rol_hi(x: u64, n: u32) -> u64 {
    let shift = n - 32u;
    return vec2<u32>((x.y << shift) | (x.x >> (32u - shift)), (x.x << shift) | (x.y >> (32u - shift)));
}

fn add_u64(a: u64, b: u64) -> u64 {
    let low = a.x + b.x;
    let carry = select(0u, 1u, low < a.x);
    return vec2<u32>(low, a.y + b.y + carry);
}

fn swap_endian(x: u32) -> u32 {
    return ((x & 0xFFu) << 24u) | ((x & 0xFF00u) << 8u) | ((x & 0xFF0000u) >> 8u) | ((x & 0xFF000000u) >> 24u);
}