// $ deno run -A run_ppp_emulation.ts
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

const addressAlice = await (await Lucid.new(undefined, "Custom"))
  .selectWalletFromPrivateKey(privateKeyAlice)
  .wallet.address();

const emulator = new Emulator([
  {
    address: addressAlice,
    assets: { lovelace: 100_000_000n },
  },
]);

const lucid = await Lucid.new(emulator);

const nft = blueprint.validators.find((v) => v.title === "ppp_mint.nft_policy");

const tokenName = "JUNGLE-GIFT-CARD";

let policyId: string;
let nftMintingPolicy: string;
let assetName: string;

const applyParamsToContract = (outputReference: OutRef) => {
  nftMintingPolicy = applyParamsToScript(nft?.compiledCode, [
    outputReference,
    fromText(tokenName),
  ]);

  policyId = lucid.utils.validatorToScriptHash({
    type: "PlutusV2",
    script: nftMintingPolicy,
  });

  assetName = `${policyId}${fromText(tokenName)}`;
};

const mintNFT = async (
  minterPrivateKey: PrivateKey,
  receiverAddress: Address,
) => {
  const owner: Lucid = lucid.selectWalletFromPrivateKey(minterPrivateKey);
  const [utxo] = await owner.wallet.getUtxos();

  const outRef: OutRef = new Constr(0, [
    new Constr(0, [utxo.txHash]),
    BigInt(utxo.outputIndex),
  ]);

  applyParamsToContract(outRef);

  const mintingPolicy = {
    type: "PlutusV2",
    script: applyDoubleCborEncoding(nftMintingPolicy),
  };

  // Change this to > 1n and script will error
  const mintAmount = 1n;

  const txHash = await owner
    .newTx()
    .collectFrom([utxo])
    // use the nft validator
    .attachMintingPolicy(mintingPolicy)
    // mint 1 of the asset
    .mintAssets({ [assetName]: mintAmount }, Data.void())
    .payToAddress(receiverAddress, { [assetName]: mintAmount })
    .complete()
    .then((tx) => tx.sign().complete())
    .then((tx) => tx.submit())
    .catch((e) => console.log(e));

  console.log(txHash);
};

console.log("Alice's balance before mint");
console.log(await getBalanceAtAddress(addressAlice));

await mintNFT(privateKeyAlice, addressAlice);
emulator.awaitBlock(4);

console.log("Alice's balance after mint");
console.log(await getBalanceAtAddress(addressAlice));

function getBalanceAtAddress(address: Address): Promise<UTxO> {
  return lucid.utxosAt(address);
}
