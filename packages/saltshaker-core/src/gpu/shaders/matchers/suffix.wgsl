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
