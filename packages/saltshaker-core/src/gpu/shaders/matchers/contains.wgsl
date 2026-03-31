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
