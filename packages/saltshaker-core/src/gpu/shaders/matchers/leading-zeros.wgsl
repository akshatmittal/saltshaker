struct MatcherData {
    min_zero_nibbles: u32,
}

fn matcher_address_byte(address: array<u32, 5>, index: u32) -> u32 {
    let word = address[index / 4u];
    return (word >> ((index % 4u) * 8u)) & 0xffu;
}

fn matcher_leading_zero_nibbles(address: array<u32, 5>) -> u32 {
    var total = 0u;
    for (var index = 0u; index < 20u; index = index + 1u) {
        let byte = matcher_address_byte(address, index);
        let high = (byte >> 4u) & 0x0fu;
        if (high == 0u) {
            total = total + 1u;
        }
        else {
            return total;
        }
        let low = byte & 0x0fu;
        if (low == 0u) {
            total = total + 1u;
        }
        else {
            return total;
        }
    }
    return total;
}

fn matcher_score(address: array<u32, 5>, matcher: MatcherData) -> u32 {
    let zero_count = matcher_leading_zero_nibbles(address);
    if (zero_count >= matcher.min_zero_nibbles) {
        return zero_count - matcher.min_zero_nibbles + 1u;
    }
    return 0u;
}
