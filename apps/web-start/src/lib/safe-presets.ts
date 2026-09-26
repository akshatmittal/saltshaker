import { encodeFunctionData, parseAbi, zeroAddress, type Address, type Hex } from "viem";

// Canonical deployments: https://github.com/safe-global/safe-deployments/tree/main/src/assets
// The proxy hash includes the ABI-encoded L1 singleton, not just proxyCreationCode().
export const SAFE_PRESETS = {
  "1.3.0": {
    factory: "0xa6B71E26C5e0845f74c812102Ca7114b6a896AB2",
    singleton: "0xd9Db270c1B5E3Bd161E8c8503c55cEABeE709552",
    fallbackHandler: "0xf48f2B2d2a534e402487b3ee7C18c33Aec0Fe5e4",
    proxyCreationCodeHash: "0x56e3081a3d1bb38ed4eed1a39f7729c3cc77c7825794c15bbf326f3047fd779c",
    to: zeroAddress,
    data: "0x",
  },
  "1.4.1": {
    factory: "0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67",
    singleton: "0x41675C099F32341bf84BFc5382aF534df5C7461a",
    fallbackHandler: "0xfd0732Dc9E303f09fCEf3a7388Ad10A83459Ec99",
    proxyCreationCodeHash: "0x76733d705f71b79841c0ee960a0ca880f779cde7ef446c989e6d23efc0a4adfb",
    to: "0xBD89A1CE4DDe368FFAB0eC35506eEcE0b1fFdc54",
    data: "0xfe51f64300000000000000000000000029fcb43b46531bca003ddc8fcb67ffe91900c762",
  },
  "1.5.0": {
    factory: "0x14F2982D601c9458F93bd70B218933A6f8165e7b",
    singleton: "0xFf51A5898e281Db6DfC7855790607438dF2ca44b",
    fallbackHandler: "0x3EfCBb83A4A7AfcB4F68D501E2c2203a38be77f4",
    proxyCreationCodeHash: "0x9dd695a8d96e2c0f6ede304e13cc2efe754fa353b7389a23340c9317113bc975",
    to: "0x900C7589200010D6C6eCaaE5B06EBe653bc2D82a",
    data: "0xfe51f643000000000000000000000000edd160febbd92e350d4d398fb636302fccd67c7e",
  },
} as const;

export type SafePreset = keyof typeof SAFE_PRESETS | "custom";

const FACTORY_ABI = parseAbi([
  "function createProxyWithNonce(address singleton, bytes initializer, uint256 saltNonce) returns (address proxy)",
]);

export function encodeSafeDeployment(singleton: Address, initializer: Hex, nonce: bigint): Hex {
  return encodeFunctionData({
    abi: FACTORY_ABI,
    functionName: "createProxyWithNonce",
    args: [singleton, initializer, nonce],
  });
}
