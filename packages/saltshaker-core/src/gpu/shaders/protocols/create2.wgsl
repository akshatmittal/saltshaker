struct ProtocolData {
    deployer: array<u32, 5>,
    salt_prefix: array<u32, 6>,
    init_code_hash: array<u32, 8>,
}

fn protocol_address(protocol: ProtocolData, nonce: xu64) -> array<u32, 5> {
    var salt: array<u32, 8>;
    for (var index = 0u; index < 6u; index = index + 1u) {
        salt[index] = protocol.salt_prefix[index];
    }
    salt[6] = swap_endian(nonce.y);
    salt[7] = swap_endian(nonce.x);

    return keccak256_85_address(protocol.deployer, salt, protocol.init_code_hash);
}
