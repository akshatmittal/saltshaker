alias xu64 = vec2<u32>;

fn make_u64(low: u32, high: u32) -> xu64 {
    return vec2<u32>(low, high);
}

fn xor_u64(a: xu64, b: xu64) -> xu64 {
    return vec2<u32>(a.x ^ b.x, a.y ^ b.y);
}

fn and_u64(a: xu64, b: xu64) -> xu64 {
    return vec2<u32>(a.x & b.x, a.y & b.y);
}

fn not_u64(a: xu64) -> xu64 {
    return vec2<u32>(~a.x, ~a.y);
}

fn rol_lo(x: xu64, n: u32) -> xu64 {
    return vec2<u32>((x.x << n) | (x.y >> (32u - n)), (x.y << n) | (x.x >> (32u - n)));
}

fn rol_hi(x: xu64, n: u32) -> xu64 {
    let shift = n - 32u;
    return vec2<u32>((x.y << shift) | (x.x >> (32u - shift)), (x.x << shift) | (x.y >> (32u - shift)));
}

fn add_u64(a: xu64, b: xu64) -> xu64 {
    let low = a.x + b.x;
    let carry = select(0u, 1u, low < a.x);
    return vec2<u32>(low, a.y + b.y + carry);
}

fn swap_endian(x: u32) -> u32 {
    return ((x & 0xFFu) << 24u) | ((x & 0xFF00u) << 8u) | ((x & 0xFF0000u) >> 8u) | ((x & 0xFF000000u) >> 24u);
}

fn theta(a: ptr<function, array<xu64, 25>>) {
    var b: array<xu64, 5>;
    var t: xu64;
    b[0] = xor_u64(xor_u64(xor_u64(xor_u64((*a)[0], (*a)[5]), (*a)[10]), (*a)[15]), (*a)[20]);
    b[1] = xor_u64(xor_u64(xor_u64(xor_u64((*a)[1], (*a)[6]), (*a)[11]), (*a)[16]), (*a)[21]);
    b[2] = xor_u64(xor_u64(xor_u64(xor_u64((*a)[2], (*a)[7]), (*a)[12]), (*a)[17]), (*a)[22]);
    b[3] = xor_u64(xor_u64(xor_u64(xor_u64((*a)[3], (*a)[8]), (*a)[13]), (*a)[18]), (*a)[23]);
    b[4] = xor_u64(xor_u64(xor_u64(xor_u64((*a)[4], (*a)[9]), (*a)[14]), (*a)[19]), (*a)[24]);

    t = xor_u64(b[4], rol_lo(b[1], 1u)); (*a)[0] = xor_u64((*a)[0], t); (*a)[5] = xor_u64((*a)[5], t); (*a)[10] = xor_u64((*a)[10], t); (*a)[15] = xor_u64((*a)[15], t); (*a)[20] = xor_u64((*a)[20], t);
    t = xor_u64(b[0], rol_lo(b[2], 1u)); (*a)[1] = xor_u64((*a)[1], t); (*a)[6] = xor_u64((*a)[6], t); (*a)[11] = xor_u64((*a)[11], t); (*a)[16] = xor_u64((*a)[16], t); (*a)[21] = xor_u64((*a)[21], t);
    t = xor_u64(b[1], rol_lo(b[3], 1u)); (*a)[2] = xor_u64((*a)[2], t); (*a)[7] = xor_u64((*a)[7], t); (*a)[12] = xor_u64((*a)[12], t); (*a)[17] = xor_u64((*a)[17], t); (*a)[22] = xor_u64((*a)[22], t);
    t = xor_u64(b[2], rol_lo(b[4], 1u)); (*a)[3] = xor_u64((*a)[3], t); (*a)[8] = xor_u64((*a)[8], t); (*a)[13] = xor_u64((*a)[13], t); (*a)[18] = xor_u64((*a)[18], t); (*a)[23] = xor_u64((*a)[23], t);
    t = xor_u64(b[3], rol_lo(b[0], 1u)); (*a)[4] = xor_u64((*a)[4], t); (*a)[9] = xor_u64((*a)[9], t); (*a)[14] = xor_u64((*a)[14], t); (*a)[19] = xor_u64((*a)[19], t); (*a)[24] = xor_u64((*a)[24], t);
}

fn rhoPi(a: ptr<function, array<xu64, 25>>) {
    var t: xu64; var b0: xu64;
    t = (*a)[1]; b0 = (*a)[10]; (*a)[10] = rol_lo(t, 1u);
    t = b0; b0 = (*a)[7]; (*a)[7] = rol_lo(t, 3u);
    t = b0; b0 = (*a)[11]; (*a)[11] = rol_lo(t, 6u);
    t = b0; b0 = (*a)[17]; (*a)[17] = rol_lo(t, 10u);
    t = b0; b0 = (*a)[18]; (*a)[18] = rol_lo(t, 15u);
    t = b0; b0 = (*a)[3]; (*a)[3] = rol_lo(t, 21u);
    t = b0; b0 = (*a)[5]; (*a)[5] = rol_lo(t, 28u);
    t = b0; b0 = (*a)[16]; (*a)[16] = rol_hi(t, 36u);
    t = b0; b0 = (*a)[8]; (*a)[8] = rol_hi(t, 45u);
    t = b0; b0 = (*a)[21]; (*a)[21] = rol_hi(t, 55u);
    t = b0; b0 = (*a)[24]; (*a)[24] = rol_lo(t, 2u);
    t = b0; b0 = (*a)[4]; (*a)[4] = rol_lo(t, 14u);
    t = b0; b0 = (*a)[15]; (*a)[15] = rol_lo(t, 27u);
    t = b0; b0 = (*a)[23]; (*a)[23] = rol_hi(t, 41u);
    t = b0; b0 = (*a)[19]; (*a)[19] = rol_hi(t, 56u);
    t = b0; b0 = (*a)[13]; (*a)[13] = rol_lo(t, 8u);
    t = b0; b0 = (*a)[12]; (*a)[12] = rol_lo(t, 25u);
    t = b0; b0 = (*a)[2]; (*a)[2] = rol_hi(t, 43u);
    t = b0; b0 = (*a)[20]; (*a)[20] = rol_hi(t, 62u);
    t = b0; b0 = (*a)[14]; (*a)[14] = rol_lo(t, 18u);
    t = b0; b0 = (*a)[22]; (*a)[22] = rol_hi(t, 39u);
    t = b0; b0 = (*a)[9]; (*a)[9] = rol_hi(t, 61u);
    t = b0; b0 = (*a)[6]; (*a)[6] = rol_lo(t, 20u);
    t = b0; b0 = (*a)[1]; (*a)[1] = rol_hi(t, 44u);
}

fn chi(a: ptr<function, array<xu64, 25>>) {
    var b: array<xu64, 5>;

    b[0] = (*a)[0]; b[1] = (*a)[1]; b[2] = (*a)[2]; b[3] = (*a)[3]; b[4] = (*a)[4];
    (*a)[0] = xor_u64(b[0], and_u64(not_u64(b[1]), b[2]));
    (*a)[1] = xor_u64(b[1], and_u64(not_u64(b[2]), b[3]));
    (*a)[2] = xor_u64(b[2], and_u64(not_u64(b[3]), b[4]));
    (*a)[3] = xor_u64(b[3], and_u64(not_u64(b[4]), b[0]));
    (*a)[4] = xor_u64(b[4], and_u64(not_u64(b[0]), b[1]));

    b[0] = (*a)[5]; b[1] = (*a)[6]; b[2] = (*a)[7]; b[3] = (*a)[8]; b[4] = (*a)[9];
    (*a)[5] = xor_u64(b[0], and_u64(not_u64(b[1]), b[2]));
    (*a)[6] = xor_u64(b[1], and_u64(not_u64(b[2]), b[3]));
    (*a)[7] = xor_u64(b[2], and_u64(not_u64(b[3]), b[4]));
    (*a)[8] = xor_u64(b[3], and_u64(not_u64(b[4]), b[0]));
    (*a)[9] = xor_u64(b[4], and_u64(not_u64(b[0]), b[1]));

    b[0] = (*a)[10]; b[1] = (*a)[11]; b[2] = (*a)[12]; b[3] = (*a)[13]; b[4] = (*a)[14];
    (*a)[10] = xor_u64(b[0], and_u64(not_u64(b[1]), b[2]));
    (*a)[11] = xor_u64(b[1], and_u64(not_u64(b[2]), b[3]));
    (*a)[12] = xor_u64(b[2], and_u64(not_u64(b[3]), b[4]));
    (*a)[13] = xor_u64(b[3], and_u64(not_u64(b[4]), b[0]));
    (*a)[14] = xor_u64(b[4], and_u64(not_u64(b[0]), b[1]));

    b[0] = (*a)[15]; b[1] = (*a)[16]; b[2] = (*a)[17]; b[3] = (*a)[18]; b[4] = (*a)[19];
    (*a)[15] = xor_u64(b[0], and_u64(not_u64(b[1]), b[2]));
    (*a)[16] = xor_u64(b[1], and_u64(not_u64(b[2]), b[3]));
    (*a)[17] = xor_u64(b[2], and_u64(not_u64(b[3]), b[4]));
    (*a)[18] = xor_u64(b[3], and_u64(not_u64(b[4]), b[0]));
    (*a)[19] = xor_u64(b[4], and_u64(not_u64(b[0]), b[1]));

    b[0] = (*a)[20]; b[1] = (*a)[21]; b[2] = (*a)[22]; b[3] = (*a)[23]; b[4] = (*a)[24];
    (*a)[20] = xor_u64(b[0], and_u64(not_u64(b[1]), b[2]));
    (*a)[21] = xor_u64(b[1], and_u64(not_u64(b[2]), b[3]));
    (*a)[22] = xor_u64(b[2], and_u64(not_u64(b[3]), b[4]));
    (*a)[23] = xor_u64(b[3], and_u64(not_u64(b[4]), b[0]));
    (*a)[24] = xor_u64(b[4], and_u64(not_u64(b[0]), b[1]));
}

fn iota(a: ptr<function, array<xu64, 25>>, roundConst: xu64) {
    (*a)[0] = xor_u64((*a)[0], roundConst);
}

fn keccakf(a: ptr<function, array<xu64, 25>>) {
    theta(a); rhoPi(a); chi(a); iota(a, make_u64(0x00000001u, 0x00000000u));
    theta(a); rhoPi(a); chi(a); iota(a, make_u64(0x00008082u, 0x00000000u));
    theta(a); rhoPi(a); chi(a); iota(a, make_u64(0x0000808au, 0x80000000u));
    theta(a); rhoPi(a); chi(a); iota(a, make_u64(0x80008000u, 0x80000000u));
    theta(a); rhoPi(a); chi(a); iota(a, make_u64(0x0000808bu, 0x00000000u));
    theta(a); rhoPi(a); chi(a); iota(a, make_u64(0x80000001u, 0x00000000u));
    theta(a); rhoPi(a); chi(a); iota(a, make_u64(0x80008081u, 0x80000000u));
    theta(a); rhoPi(a); chi(a); iota(a, make_u64(0x00008009u, 0x80000000u));
    theta(a); rhoPi(a); chi(a); iota(a, make_u64(0x0000008au, 0x00000000u));
    theta(a); rhoPi(a); chi(a); iota(a, make_u64(0x00000088u, 0x00000000u));
    theta(a); rhoPi(a); chi(a); iota(a, make_u64(0x80008009u, 0x00000000u));
    theta(a); rhoPi(a); chi(a); iota(a, make_u64(0x8000000au, 0x00000000u));
    theta(a); rhoPi(a); chi(a); iota(a, make_u64(0x8000808bu, 0x00000000u));
    theta(a); rhoPi(a); chi(a); iota(a, make_u64(0x0000008bu, 0x80000000u));
    theta(a); rhoPi(a); chi(a); iota(a, make_u64(0x00008089u, 0x80000000u));
    theta(a); rhoPi(a); chi(a); iota(a, make_u64(0x00008003u, 0x80000000u));
    theta(a); rhoPi(a); chi(a); iota(a, make_u64(0x00008002u, 0x80000000u));
    theta(a); rhoPi(a); chi(a); iota(a, make_u64(0x00000080u, 0x80000000u));
    theta(a); rhoPi(a); chi(a); iota(a, make_u64(0x0000800au, 0x00000000u));
    theta(a); rhoPi(a); chi(a); iota(a, make_u64(0x8000000au, 0x80000000u));
    theta(a); rhoPi(a); chi(a); iota(a, make_u64(0x80008081u, 0x80000000u));
    theta(a); rhoPi(a); chi(a); iota(a, make_u64(0x00008080u, 0x80000000u));
    theta(a); rhoPi(a); chi(a); iota(a, make_u64(0x80000001u, 0x00000000u));
    theta(a); rhoPi(a); chi(a); iota(a, make_u64(0x80008008u, 0x80000000u));
}

fn keccak256_64(input: array<u32, 16>) -> array<u32, 8> {
    var state: array<xu64, 25>;
    for (var i = 0u; i < 25u; i++) {
        state[i] = make_u64(0u, 0u);
    }

    for (var i = 0u; i < 8u; i++) {
        state[i] = make_u64(input[i * 2u], input[i * 2u + 1u]);
    }

    state[8] = xor_u64(state[8], make_u64(0x01u, 0u));
    state[16] = xor_u64(state[16], make_u64(0u, 0x80000000u));

    keccakf(&state);

    var result: array<u32, 8>;
    for (var i = 0u; i < 4u; i++) {
        result[i * 2u] = state[i].x;
        result[i * 2u + 1u] = state[i].y;
    }
    return result;
}

fn keccak256_85_address(factory: array<u32, 5>, salt: array<u32, 8>, code_hash: array<u32, 8>) -> array<u32, 5> {
    var state: array<xu64, 25>;
    for (var i = 0u; i < 25u; i++) {
        state[i] = make_u64(0u, 0u);
    }

    let s0_low = 0xFFu | (factory[0] << 8u);
    let s0_high = (factory[0] >> 24u) | (factory[1] << 8u);
    state[0] = make_u64(s0_low, s0_high);

    let s1_low = (factory[1] >> 24u) | (factory[2] << 8u);
    let s1_high = (factory[2] >> 24u) | (factory[3] << 8u);
    state[1] = make_u64(s1_low, s1_high);

    let s2_low = (factory[3] >> 24u) | (factory[4] << 8u);
    let s2_high = (factory[4] >> 24u) | (salt[0] << 8u);
    state[2] = make_u64(s2_low, s2_high);

    let s3_low = (salt[0] >> 24u) | (salt[1] << 8u);
    let s3_high = (salt[1] >> 24u) | (salt[2] << 8u);
    state[3] = make_u64(s3_low, s3_high);

    let s4_low = (salt[2] >> 24u) | (salt[3] << 8u);
    let s4_high = (salt[3] >> 24u) | (salt[4] << 8u);
    state[4] = make_u64(s4_low, s4_high);

    let s5_low = (salt[4] >> 24u) | (salt[5] << 8u);
    let s5_high = (salt[5] >> 24u) | (salt[6] << 8u);
    state[5] = make_u64(s5_low, s5_high);

    let s6_low = (salt[6] >> 24u) | (salt[7] << 8u);
    let s6_high = (salt[7] >> 24u) | (code_hash[0] << 8u);
    state[6] = make_u64(s6_low, s6_high);

    let s7_low = (code_hash[0] >> 24u) | (code_hash[1] << 8u);
    let s7_high = (code_hash[1] >> 24u) | (code_hash[2] << 8u);
    state[7] = make_u64(s7_low, s7_high);

    let s8_low = (code_hash[2] >> 24u) | (code_hash[3] << 8u);
    let s8_high = (code_hash[3] >> 24u) | (code_hash[4] << 8u);
    state[8] = make_u64(s8_low, s8_high);

    let s9_low = (code_hash[4] >> 24u) | (code_hash[5] << 8u);
    let s9_high = (code_hash[5] >> 24u) | (code_hash[6] << 8u);
    state[9] = make_u64(s9_low, s9_high);

    let s10_low = (code_hash[6] >> 24u) | (code_hash[7] << 8u);
    let s10_high = (code_hash[7] >> 24u) | (0x01u << 8u);
    state[10] = make_u64(s10_low, s10_high);

    state[16] = make_u64(0u, 0x80000000u);
    keccakf(&state);

    var result: array<u32, 5>;
    result[0] = state[1].y;
    result[1] = state[2].x;
    result[2] = state[2].y;
    result[3] = state[3].x;
    result[4] = state[3].y;
    return result;
}
