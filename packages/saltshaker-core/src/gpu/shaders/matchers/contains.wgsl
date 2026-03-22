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
    if (matcher.value_len == 0u) {
        return true;
    }
    let last_start = 20u - matcher.value_len;
    for (var start = 0u; start <= last_start; start = start + 1u) {
        var matched = true;
        for (var index = 0u; index < matcher.value_len; index = index + 1u) {
            if (matcher_address_byte(address, start + index) != matcher_pattern_byte(matcher.value, index)) {
                matched = false;
                break;
            }
        }
        if (matched) {
            return true;
        }
    }
    return false;
}
