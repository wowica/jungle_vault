# JUNGLE Vault 🔐

This is a slightly modified version of the [Gift Card](https://aiken-lang.org/example--gift-card) demo application using [Aiken](https://aiken-lang.org/) for on-chain Cardano code and [Lucid](https://lucid.spacebudz.io/) for off-chain transaction building.

## Running

The application runs using Lucid emulator and requires [Deno](https://docs.deno.com/runtime/manual/getting_started/installation) to be installed.

To run the application, run the following command:  

`deno run -A run_emulation.ts`

The first time it runs, Deno will first download all dependencies. It does not, however, communicate with a real Cardano network nor does it depend on any funds.
