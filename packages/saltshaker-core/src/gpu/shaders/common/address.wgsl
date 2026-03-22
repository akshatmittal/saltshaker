fn keccak256_85_address(factory: array<u32, 5>, salt: array<u32, 8>, code_hash: array<u32, 8>) -> array<u32, 5> {
    var state: array<u64, 25>;
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
