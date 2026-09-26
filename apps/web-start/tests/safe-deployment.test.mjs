import { encodeSafeInitializer } from "@akshatmittal/saltshaker";
import assert from "node:assert/strict";
import { test } from "node:test";
import { decodeFunctionData, encodeAbiParameters, getCreate2Address, keccak256, parseAbi, zeroAddress } from "viem";

import { SAFE_PRESETS, encodeSafeDeployment } from "../src/lib/safe-presets.ts";

const factoryAbi = parseAbi([
  "function createProxyWithNonce(address singleton, bytes initializer, uint256 saltNonce) returns (address proxy)",
]);

test("copied deployment calldata reproduces the known mainnet Safe", () => {
  const preset = SAFE_PRESETS["1.5.0"];
  const initializer = encodeSafeInitializer({
    ...preset,
    protocol: "safe",
    owners: ["0x33333333Bd7045F1A601A1E289D7AB21036fB5EF"],
    threshold: 1n,
    to: zeroAddress,
    data: "0x",
    paymentToken: zeroAddress,
    payment: 0n,
    paymentReceiver: zeroAddress,
  });
  const calldata = encodeSafeDeployment(preset.singleton, initializer, 338113103878n);
  const decoded = decodeFunctionData({ abi: factoryAbi, data: calldata });
  assert.equal(decoded.functionName, "createProxyWithNonce");
  assert.equal(decoded.args[0].toLowerCase(), preset.singleton.toLowerCase());
  assert.equal(decoded.args[2], 338113103878n);
  const salt = keccak256(
    encodeAbiParameters([{ type: "bytes32" }, { type: "uint256" }], [keccak256(decoded.args[1]), decoded.args[2]]),
  );
  assert.equal(
    getCreate2Address({ from: preset.factory, salt, bytecodeHash: preset.proxyCreationCodeHash }),
    "0x311311311A0F18744B2489b529E03fE0201E6363",
  );
});

test("calldata preserves uint256 nonces beyond JavaScript's safe integer range", () => {
  const nonce = (1n << 256n) - 1n;
  const decoded = decodeFunctionData({
    abi: factoryAbi,
    data: encodeSafeDeployment(SAFE_PRESETS["1.4.1"].singleton, "0x", nonce),
  });
  assert.equal(decoded.args[2], nonce);
});
