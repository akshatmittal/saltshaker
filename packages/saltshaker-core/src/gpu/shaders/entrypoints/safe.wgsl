struct Constants {
    initializer_hash: array<u32, 8>,
    factory: array<u32, 5>,
    proxy_code_hash: array<u32, 8>,
    matcher: MatcherData,
}

struct Params {
    nonce_low: u32,
    nonce_high: u32,
}

struct BestResult {
    nonce_low: atomic<u32>,
    nonce_high: atomic<u32>,
    addr: array<atomic<u32>, 5>,
    score: atomic<u32>,
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
    let score = matcher_score(address, constants.matcher);
    if (score == 0u) {
        return;
    }

    let best_score = atomicLoad(&best.score);
    if (score > best_score) {
        atomicStore(&best.addr[0], address[0]);
        atomicStore(&best.addr[1], address[1]);
        atomicStore(&best.addr[2], address[2]);
        atomicStore(&best.addr[3], address[3]);
        atomicStore(&best.addr[4], address[4]);
        atomicStore(&best.nonce_low, nonce.x);
        atomicStore(&best.nonce_high, nonce.y);
        atomicStore(&best.score, score);
    }
}
