struct ProtocolData {
    initializer_hash: array<u32, 8>,
    factory: array<u32, 5>,
    proxy_code_hash: array<u32, 8>,
}

fn protocol_address(protocol: ProtocolData, nonce: xu64) -> array<u32, 5> {
    var salt_input: array<u32, 16>;
    for (var index = 0u; index < 8u; index = index + 1u) {
        salt_input[index] = protocol.initializer_hash[index];
    }
    salt_input[8] = 0u;
    salt_input[9] = 0u;
    salt_input[10] = 0u;
    salt_input[11] = 0u;
    salt_input[12] = 0u;
    salt_input[13] = 0u;
    salt_input[14] = swap_endian(nonce.y);
    salt_input[15] = swap_endian(nonce.x);

    let derived_salt = keccak256_64(salt_input);
    return keccak256_85_address(protocol.factory, derived_salt, protocol.proxy_code_hash);
}
