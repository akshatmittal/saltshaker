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

fn is_smaller(new_addr: array<u32, 5>, best0: u32, best1: u32, best2: u32, best3: u32, best4: u32) -> bool {
    let n0 = swap_endian(new_addr[0]);
    let n1 = swap_endian(new_addr[1]);
    let n2 = swap_endian(new_addr[2]);
    let n3 = swap_endian(new_addr[3]);
    let n4 = swap_endian(new_addr[4]);

    let b0 = swap_endian(best0);
    let b1 = swap_endian(best1);
    let b2 = swap_endian(best2);
    let b3 = swap_endian(best3);
    let b4 = swap_endian(best4);

    if (n0 < b0) {
        return true;
    }
    if (n0 > b0) {
        return false;
    }
    if (n1 < b1) {
        return true;
    }
    if (n1 > b1) {
        return false;
    }
    if (n2 < b2) {
        return true;
    }
    if (n2 > b2) {
        return false;
    }
    if (n3 < b3) {
        return true;
    }
    if (n3 > b3) {
        return false;
    }
    if (n4 < b4) {
        return true;
    }
    return false;
}
