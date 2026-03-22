struct MatcherData {
    _padding0: u32,
    _padding1: u32,
    _padding2: u32,
    _padding3: u32,
}

fn matcher_matches(address: array<u32, 5>, matcher: MatcherData) -> bool {
    return true;
}
