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
    if (matcher.value_len_nibbles == 0u) {
        return 0u;
    }

    var previous: array<u32, 41>;
    var current: array<u32, 41>;
    var best = 0u;

    for (var address_index = 1u; address_index <= 40u; address_index = address_index + 1u) {
        current[0] = 0u;
        for (var value_index = 1u; value_index <= matcher.value_len_nibbles; value_index = value_index + 1u) {
            if (
                matcher_address_nibble(address, address_index - 1u) ==
                matcher_pattern_nibble(matcher.value, value_index - 1u)
            ) {
                let score = previous[value_index - 1u] + 1u;
                current[value_index] = score;
                if (score > best) {
                    best = score;
                }
            } else {
                current[value_index] = 0u;
            }
        }

        for (var value_index = 0u; value_index <= matcher.value_len_nibbles; value_index = value_index + 1u) {
            previous[value_index] = current[value_index];
            current[value_index] = 0u;
        }
    }

    return best;
}
