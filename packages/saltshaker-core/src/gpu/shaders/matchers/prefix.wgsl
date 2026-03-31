fn matcher_score(address: array<u32, 5>, matcher: MatcherData) -> u32 {
    var score = 0u;
    for (var index = 0u; index < matcher.value_len_nibbles; index = index + 1u) {
        if (matcher_address_nibble(address, index) != matcher_pattern_nibble(matcher.value, index)) {
            break;
        }
        score = score + 1u;
    }
    return score;
}
