struct MatcherData {
    value: array<u32, 10>,
    value_len_nibbles: u32,
}

fn matcher_address_byte(address: array<u32, 5>, index: u32) -> u32 {
    let word = address[index / 4u];
    return (word >> ((index % 4u) * 8u)) & 0xffu;
}

fn matcher_address_nibble(address: array<u32, 5>, index: u32) -> u32 {
    let byte = matcher_address_byte(address, index / 2u);
    if ((index % 2u) == 0u) {
        return (byte >> 4u) & 0x0fu;
    }
    return byte & 0x0fu;
}

fn matcher_pattern_nibble(pattern: array<u32, 10>, index: u32) -> u32 {
    let word = pattern[index / 4u];
    return (word >> ((index % 4u) * 8u)) & 0xffu;
}

fn matcher_score(address: array<u32, 5>, matcher: MatcherData) -> u32 {
    var score = 0u;
    for (var offset = 0u; offset < matcher.value_len_nibbles; offset = offset + 1u) {
        let address_index = 39u - offset;
        let value_index = matcher.value_len_nibbles - 1u - offset;
        if (matcher_address_nibble(address, address_index) != matcher_pattern_nibble(matcher.value, value_index)) {
            break;
        }
        score = score + 1u;
    }
    return score;
}
