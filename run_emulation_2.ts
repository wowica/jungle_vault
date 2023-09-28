// $ deno run -A run_emulation_2.ts
import {
  Address,
  applyDoubleCborEncoding,
  applyParamsToScript,
  Constr,
  Data,
  Emulator,
  fromText,
  generatePrivateKey,
  Lucid,
  OutRef,
  PrivateKey,
  UTxO,
} from "https://deno.land/x/lucid/mod.ts";

// Imports blueprint generated from `aiken build`
// Blueprints CIP: https://cips.cardano.org/cips/cip57/
import blueprint from "./plutus.json" assert { type: "json" };

// Define wallets, balances and Custom network

const privateKeyAlice = generatePrivateKey();
const privateKeyBob = generatePrivateKey();

const addressAlice = await (await Lucid.new(undefined, "Custom"))
  .selectWalletFromPrivateKey(privateKeyAlice).wallet.address();

const addressBob = await (await Lucid.new(undefined, "Custom"))
  .selectWalletFromPrivateKey(privateKeyBob).wallet.address();

const emulator = new Emulator([{
  address: addressAlice,
  assets: { lovelace: 100_000_000n },
}, {
  address: addressBob,
  assets: { lovelace: 100_000_000n },
}]);

const lucid = await Lucid.new(emulator);

const masterKey = blueprint.validators.find((v) =>
  v.title === "mint.master_key"
);
const redeem = blueprint.validators.find((v) => v.title === "mint.redeem");

const tokenName = "JUNGLE-GIFT-CARD";
let policyId, masterKeyMintingPolicy, assetName, redeemValidator, lockAddress;

const applyParamsToContract = (outputReference: OutRef) => {
  masterKeyMintingPolicy = applyParamsToScript(
    masterKey?.compiledCode,
    [
      fromText(tokenName),
      outputReference,
    ],
  );

  policyId = lucid.utils.validatorToScriptHash({
    type: "PlutusV2",
    script: masterKeyMintingPolicy,
  });

  assetName = `${policyId}${fromText(tokenName)}`;

  redeemValidator = applyParamsToScript(redeem?.compiledCode, [
    fromText(tokenName),
    policyId,
  ]);

  lockAddress = lucid.utils.validatorToAddress({
    type: "PlutusV2",
    script: redeemValidator,
  });
};

const mintMasterKey = async (
  minterPrivateKey: PrivateKey,
  receiverAddress: Address,
  giftAmountInAda: number,
) => {
  const owner: Lucid = lucid.selectWalletFromPrivateKey(minterPrivateKey);
  const [utxo] = await owner.wallet.getUtxos();
  //   console.log({ utxo });

  const outRef: OutRef = new Constr(0, [
    new Constr(0, [utxo.txHash]),
    BigInt(utxo.outputIndex),
  ]);

  applyParamsToContract(outRef);

  const mintRedeemer = Data.to(new Constr(0, []));

  const txHash = await owner.newTx()
    .collectFrom([utxo])
    // use the master_key validator
    .attachMintingPolicy(
      {
        type: "PlutusV2",
        script: applyDoubleCborEncoding(masterKeyMintingPolicy),
      },
    )
    // mint 1 of the asset
    .mintAssets(
      { [assetName]: BigInt(1) },
      // this redeemer is the first argument to the master_key validator
      mintRedeemer,
    )
    .payToContract(
      lockAddress,
      {
        // On unlock this gets passed to the redeem
        // validator as datum. Our redeem validator
        // doesn't use it so we can just pass in anything.
        inline: Data.void(),
      },
      { lovelace: BigInt(giftAmountInAda * 1_000_000) },
    ).payToAddress(receiverAddress, { [assetName]: 1n })
    .complete()
    .then((tx) => tx.sign().complete())
    .then((tx) => tx.submit());

  console.log(txHash);
};

const redeemGift = async (minterPrivateKey: PrivateKey) => {
  const owner: Lucid = lucid.selectWalletFromPrivateKey(minterPrivateKey);
  const utxos = await lucid.utxosAt(lockAddress);
  // console.log({ utxos });

  const burnRedeemer = Data.to(new Constr(1, []));

  const txHash = await owner.newTx()
    .collectFrom(
      utxos,
      // This is the second argument to the redeem validator
      // and we also don't do anything with it similar to the
      // inline datum. It's fine to pass in anything in this case.
      Data.void(),
    )
    // use the master_key validator again
    .attachMintingPolicy(
      {
        type: "PlutusV2",
        script: applyDoubleCborEncoding(masterKeyMintingPolicy),
      },
    )
    // use the redeem validator
    .attachSpendingValidator({
      type: "PlutusV2",
      script: applyDoubleCborEncoding(redeemValidator),
    })
    .mintAssets(
      // notice the negative one here
      { [assetName]: BigInt(-1) },
      // this redeemer is the first argument to the master_key validator
      burnRedeemer,
    )
    .complete()
    .then((tx) => tx.sign().complete())
    .then((tx) => tx.submit());
  console.log({ txHash });
};

const bobGiftAmount = 22;
console.log(
  `Alice minting Master Key, sending to Bob and paying ${bobGiftAmount} to contract`,
);
await mintMasterKey(privateKeyAlice, addressBob, bobGiftAmount);
emulator.awaitBlock(4);

console.log("Contract after receiving payment");
console.log(await getBalanceAtAddress(lockAddress));

try {
  console.log("Alice attempting to redeem Gift");
  await redeemGift(privateKeyAlice);
  emulator.awaitBlock(4);
} catch (e) {
  console.log("🚫 Alice cannot redeem Gift 🚫");
  console.log("error " + e);
}

console.log("Bob redeeming Master Key");
await redeemGift(privateKeyBob);
emulator.awaitBlock(4);

console.log("Bob after minting Master Key");
console.log(await getBalanceAtAddress(addressBob));

function getBalanceAtAddress(address: Address): Promise<UTxO> {
  return lucid.utxosAt(address);
}
