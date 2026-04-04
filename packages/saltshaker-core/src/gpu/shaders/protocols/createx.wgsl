struct ProtocolData {
    factory: array<u32, 5>,
    salt_prefix: array<u32, 6>,
    caller: array<u32, 5>,
    chain_id: array<u32, 8>,
    code_hash: array<u32, 8>,
    flags: u32,
}

fn createx_guard_mode(protocol: ProtocolData) -> u32 {
    return protocol.flags >> 8u;
}

fn createx_operation(protocol: ProtocolData) -> u32 {
    return protocol.flags & 0xffu;
}

fn createx_guarded_salt(protocol: ProtocolData, nonce: xu64) -> array<u32, 8> {
    var salt: array<u32, 8>;
    for (var index = 0u; index < 6u; index = index + 1u) {
        salt[index] = protocol.salt_prefix[index];
    }
    salt[6] = swap_endian(nonce.y);
    salt[7] = swap_endian(nonce.x);

    let guard_mode = createx_guard_mode(protocol);
    if (guard_mode == 0u) {
        return keccak256_32(salt);
    }

    if (guard_mode == 1u) {
        var sender_input: array<u32, 16>;
        sender_input[0] = 0u;
        sender_input[1] = 0u;
        sender_input[2] = 0u;
        for (var index = 0u; index < 5u; index = index + 1u) {
            sender_input[index + 3u] = protocol.caller[index];
            sender_input[index + 8u] = salt[index];
        }
        sender_input[13] = salt[5];
        sender_input[14] = salt[6];
        sender_input[15] = salt[7];
        return keccak256_64(sender_input);
    }

    if (guard_mode == 2u) {
        var xchain_input: array<u32, 16>;
        for (var index = 0u; index < 8u; index = index + 1u) {
            xchain_input[index] = protocol.chain_id[index];
            xchain_input[index + 8u] = salt[index];
        }
        return keccak256_64(xchain_input);
    }

    var sender_xchain_input: array<u32, 24>;
    sender_xchain_input[0] = 0u;
    sender_xchain_input[1] = 0u;
    sender_xchain_input[2] = 0u;
    for (var index = 0u; index < 5u; index = index + 1u) {
        sender_xchain_input[index + 3u] = protocol.caller[index];
    }
    for (var index = 0u; index < 8u; index = index + 1u) {
        sender_xchain_input[index + 8u] = protocol.chain_id[index];
        sender_xchain_input[index + 16u] = salt[index];
    }
    return keccak256_96(sender_xchain_input);
}

fn protocol_address(protocol: ProtocolData, nonce: xu64) -> array<u32, 5> {
    let guarded_salt = createx_guarded_salt(protocol, nonce);
    if (createx_operation(protocol) == 0u) {
        return keccak256_85_address(protocol.factory, guarded_salt, protocol.code_hash);
    }

    let proxy = keccak256_85_address(protocol.factory, guarded_salt, protocol.code_hash);
    return keccak256_23_address(proxy);
}
