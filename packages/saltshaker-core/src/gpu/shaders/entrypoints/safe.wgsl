struct Constants {
    initializer_hash: array<u32, 8>,
    factory: array<u32, 5>,
    proxy_code_hash: array<u32, 8>,
    matcher: MatcherData,
}

struct Params {
    nonce_low: u32,
    nonce_high: u32,
    _padding0: u32,
    _padding1: u32,
}

struct BestResult {
    nonce_low: atomic<u32>,
    nonce_high: atomic<u32>,
    addr0: atomic<u32>,
    addr1: atomic<u32>,
    addr2: atomic<u32>,
    addr3: atomic<u32>,
    addr4: atomic<u32>,
    found: atomic<u32>,
}

@group(0) @binding(0)
var<storage, read> constants: Constants;
@group(0) @binding(1)
var<uniform> params: Params;
@group(0) @binding(2)
var<storage, read_write> best: BestResult;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let offset = global_id.x + global_id.y * 4194240u;
    let nonce = add_u64(make_u64(params.nonce_low, params.nonce_high), make_u64(offset, 0u));

    var salt_input: array<u32, 16>;
    for (var index = 0u; index < 8u; index = index + 1u) {
        salt_input[index] = constants.initializer_hash[index];
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
    let address = keccak256_85_address(constants.factory, derived_salt, constants.proxy_code_hash);
    if (!matcher_matches(address, constants.matcher)) {
        return;
    }

    let best0 = atomicLoad(&best.addr0);
    let best1 = atomicLoad(&best.addr1);
    let best2 = atomicLoad(&best.addr2);
    let best3 = atomicLoad(&best.addr3);
    let best4 = atomicLoad(&best.addr4);

    if (is_smaller(address, best0, best1, best2, best3, best4)) {
        atomicStore(&best.addr0, address[0]);
        atomicStore(&best.addr1, address[1]);
        atomicStore(&best.addr2, address[2]);
        atomicStore(&best.addr3, address[3]);
        atomicStore(&best.addr4, address[4]);
        atomicStore(&best.nonce_low, nonce.x);
        atomicStore(&best.nonce_high, nonce.y);
        atomicStore(&best.found, 1u);
    }
}
