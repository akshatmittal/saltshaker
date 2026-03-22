struct MatcherData {
    value: array<u32, 5>,
    value_len: u32,
    _padding0: u32,
    _padding1: u32,
    _padding2: u32,
}

fn matcher_address_byte(address: array<u32, 5>, index: u32) -> u32 {
    let word = address[index / 4u];
    return (word >> ((index % 4u) * 8u)) & 0xffu;
}

fn matcher_pattern_byte(pattern: array<u32, 5>, index: u32) -> u32 {
    let word = pattern[index / 4u];
    return (word >> ((index % 4u) * 8u)) & 0xffu;
}

fn matcher_matches(address: array<u32, 5>, matcher: MatcherData) -> bool {
    for (var index = 0u; index < matcher.value_len; index = index + 1u) {
        if (matcher_address_byte(address, index) != matcher_pattern_byte(matcher.value, index)) {
            return false;
        }
    }
    return true;
}
