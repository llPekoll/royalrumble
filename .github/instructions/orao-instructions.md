VRF Oracles
Pricing Oracles
Services
Get in touch

VRF
ORAO’s verifiable random function - unbiased and provable randomness
VRF v2: a multinode verifiable random function oracle (based on EDDSA). ORAO VRF empowers the solana ecosystem by providing unbiased verifiable randomness on Solana through a byzantine quorum of fulfilment nodes.

Start building with ORAO VRF

Solana VRF Comparison
Feature	ORAO Network	Switchboard
VRF Type	Proof of Authority	Aggregator-bases
Support	Multiple code examples and active dev support on Telegram	Unknown
Development	Active development and service upgrades	Rare
Speed	Sub-Second possible, 4-20s	Several Minutes
Cost	Low = 0.001 SOL
fees kept the same since Mainnet deployment	High = 0.007+ SOL
VRF code samples
Solana Program SDK
Our on-chain SDK is built on Anchor.

To get started, clone the github repo
copied to clipboard
git clone git@github.com:orao-network/solana-vrf

and import the SDK crate to your Anchor.toml

Cross-Program Invocation (CPI) example
Pick up the necessary account info and make a VRF request as a CPI.
The SDK is documented in detail on docs.rs.

Github repo contains an open source on-chain Russian Roulette game.
copied to clipboard
// Request randomness.
let cpi_program = ctx.accounts.vrf.to_account_info();
let cpi_accounts = RequestV2 {
payer: ctx.accounts.player.to_account_info(),
network_state: ctx.accounts.config.to_account_info(),
treasury: ctx.accounts.treasury.to_account_info(),
request: ctx.accounts.random.to_account_info(),
system_program: ctx.accounts.system_program.to_account_info(),
};
let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
orao_solana_vrf::cpi::request_v2(cpi_ctx, force)?;
												

Off-chain Rust example
For off-chain calls you can send a transaction like this:
copied to clipboard
use anchor_client::*;
// connect to devnet
let client = Client::new(Cluster::Devnet, payer);
let program = client.program(orao_solana_vrf::id());

// generate a request seed
let seed = rand::random();
// build and send a transaction. make sure the payer has enough lamports
let tx = orao_solana_vrf::RequestBuilder::new(seed)
    .build(&program)?
    .send()?;

println!("Request TX: {}", tx);
//wait for fulfilment
Solana SDK
JavaScript SDK
Solana VRF Github Repo
VRF Fulfillment Flow
ORAO VRF was designed to be secure, unbiased, affordable and fast randomness generator.

1. Client submits a VRF request
2. VRF nodes detect changes on all randomness accounts
3. VRF nodes generate randomness and send it on-chain
4. ORAO VRF Program checks signatures and XORs the randomness given by authoritative nodes
5. When a byzantine quorum is achieved the randomness request is fullfilled and stored to the on-chain account for usage
About
Services
Medium
Github
Quick Integration
Solana VRF
Fuel VRF
zkVRF
Socials
Twitter
Telegram Community
Telegram ANN

© 2024 ORAO
Terms of Use Privacy Policy
