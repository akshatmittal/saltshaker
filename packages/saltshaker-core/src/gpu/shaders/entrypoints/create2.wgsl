struct Constants {
    deployer: array<u32, 5>,
    salt_prefix: array<u32, 6>,
    init_code_hash: array<u32, 8>,
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

    var salt: array<u32, 8>;
    for (var index = 0u; index < 6u; index = index + 1u) {
        salt[index] = constants.salt_prefix[index];
    }
    salt[6] = swap_endian(nonce.y);
    salt[7] = swap_endian(nonce.x);

    let address = keccak256_85_address(constants.deployer, salt, constants.init_code_hash);
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
