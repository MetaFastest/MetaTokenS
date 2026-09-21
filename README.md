# MetaTokenS — Meta Stock Token (METAS)

An ERC-20 token with owner-managed time locks and on-chain vote recording, built with Hardhat on top of OpenZeppelin Contracts 5.x.

The repository contains a single contract, `MetaStockToken`, together with an integration test and a deployment script.

---

## Token at a glance

| Item | Value |
|---|---|
| Name / Symbol | `Meta Stock Token` / `METAS` |
| Decimals | **6** |
| Initial supply | 200,000,000 METAS, minted to the address that sends the deployment transaction |
| Minting | Owner only (`mint`) |
| Burning | Anyone, from their own balance (`burn`, `burnFrom`) |
| Pausing | Owner can halt all transfers, mints and burns (`pause` / `unpause`) |
| Signed approvals | EIP-2612 `permit` |
| Reentrancy protection | `nonReentrant` on transfer, lock and vote functions |
| Solidity | `0.8.20`, optimizer enabled |

Contract source: [`contracts/MetaStockToken.sol`](contracts/MetaStockToken.sol)

Inherits: `ERC20` · `ERC20Burnable` · `ERC20Pausable` · `Ownable` · `ERC20Permit` · `ReentrancyGuard`

---

## Features

### 1. Token locks

A lock takes part of a holder's balance out of circulation until a given `releaseTime`.

- Locked tokens are **removed from `balanceOf`** and kept in a per-address lock list. They return to the balance when released.
- Each address can hold at most **50 locks** (`MAX_LOCK_COUNT`).
- Locks whose `releaseTime` has passed are released automatically when:
  - the holder calls `transfer`,
  - someone calls `transferFrom` on the holder's behalf, or
  - the holder calls `releaseLocks()` directly.
- The owner can release any lock early with `unlock`, regardless of `releaseTime`.

| Function | Access | Description |
|---|---|---|
| `lock(holder, value, releaseTime)` | Owner | Move `value` out of `holder`'s balance and lock it until `releaseTime` |
| `unlock(holder, i)` | Owner | Release `holder`'s `i`-th lock immediately |
| `transferWithLock(to, value, releaseTime)` | Owner | Send `value` from the owner to `to`, arriving already locked |
| `releaseLocks()` | Anyone | Release all of the caller's expired locks |
| `lockCount(holder)` | View | Number of active locks |
| `lockState(holder, idx)` | View | `(releaseTime, balance)` of one lock |
| `lockStateList(holder)` | View | The full lock list |

Events: `Lock(holder, value, releaseTime)` · `Unlock(holder, value)`

> **Lock order is not stable.** Releasing a lock uses swap-and-pop: the last entry is moved into the freed slot and the list is shortened. Indexes change after any release, so re-read `lockStateList` before referring to a lock by index.

### 2. Token voting

The owner registers **one active proposal at a time**. Holders vote by committing tokens, and the committed tokens are **locked automatically until the proposal's end date**.

| Function | Access | Description |
|---|---|---|
| `updateVoteInfo(proposalId, threshold, quorum, endDate)` | Owner | Set the active proposal. Calling it again overwrites the previous one |
| `getVoteInfo()` | View | Current proposal as `(proposalId, threshold, quorum, endDate)` |
| `vote(proposalId, value, option)` | Anyone | Commit `value` tokens to `option`. Requires `value >= threshold` and `now <= endDate` |
| `getVoteHistory(proposalId, idx)` | View | The **caller's** `idx`-th vote on that proposal |
| `getVoteHistoryList(proposalId)` | View | All of the **caller's** votes on that proposal |

Event: `Vote(voter, proposalId, option, value)`

Rules:

- A `proposalId` that does not match the active proposal is rejected.
- A holder may vote several times on the same proposal, including on different options. Each vote is recorded separately.
- `quorum` is **stored but not enforced on-chain**. Tallying and quorum checks are expected to happen off-chain from `Vote` events.
- The history getters are scoped to `msg.sender`. Use event logs to read other holders' votes.

### 3. Standard ERC-20 and admin

- `transfer` / `transferFrom` — release the sender's expired locks first, then transfer.
- `mint(to, amount)` — owner only.
- `pause()` / `unpause()` — owner only. While paused, every balance movement (transfer, mint, burn, lock, release) reverts with `EnforcedPause`.
- `permit(...)` — approve by signature (EIP-2612).

---

## Getting started

### Requirements

- Node.js 18 or later
- `yarn` (a `yarn.lock` is committed) or `npm`

### Install

```bash
yarn install
```

### Compile

```bash
npx hardhat compile
```

### Test

```bash
yarn test
```

There is one integration test, [`test/test.ts`](test/test.ts). It walks through name, symbol, decimals, initial supply, minting, transfers, burning, pausing, locks, automatic release, `transferWithLock`, `releaseLocks` and voting in a single flow.

The test waits for real wall-clock time so that locks expire (two 15-second sleeps), so **a full run takes 30 seconds or more**. That is expected.

### Deploy

1. Add a target network to [`hardhat.config.ts`](hardhat.config.ts). The current config only has the built-in Hardhat network.

   ```ts
   networks: {
     sepolia: {
       url: process.env.RPC_URL!,
       accounts: [process.env.PRIVATE_KEY!],
     },
   },
   ```

2. Fill in `initialOwner` in [`scripts/deploy.ts`](scripts/deploy.ts). The file currently has a `// TODO` and the variable is not defined, so **it will not run as-is**.

   ```ts
   const initialOwner = "0x..."; // Ownable owner address
   const instance = await ContractFactory.deploy(initialOwner);
   ```

3. Run the script:

   ```bash
   npx hardhat run --network <network-name> scripts/deploy.ts
   ```

> **The initial supply goes to the deployer (`msg.sender`), not to `initialOwner`.** If the owner and the deployer are different addresses, the tokens end up with the deployer and the admin rights with the owner. Confirm this is what you want before deploying.

Keep secrets in `.env`. It is already listed in `.gitignore`.

---

## Things to know

- **Locks temporarily reduce `totalSupply`.** Internally, locking moves tokens to `address(0)` and releasing mints them back. While tokens are locked, `totalSupply()` is lower by that amount, and a `Transfer(holder, 0x0)` event fires on lock and `Transfer(0x0, holder)` on release. Tools that compute circulating supply from these values need to account for this.
- **An address at the lock limit** rejects `lock`, `transferWithLock` and `vote` with `Exceeded max lock count`. Calling `releaseLocks()` to clear expired locks makes room again.
- The `option >= 0` check in `vote` is always true because `option` is a `uint256`. The contract does not validate the option range; do that in the application.
- There is no audit on record for this repository. Have the contract reviewed before a mainnet deployment.

---

## Project layout

```
.
├── contracts/
│   └── MetaStockToken.sol   # Token contract (ERC-20 + locks + voting)
├── scripts/
│   └── deploy.ts            # Deployment script (set initialOwner first)
├── test/
│   └── test.ts              # Single integration test (30+ seconds)
├── hardhat.config.ts        # Solidity 0.8.20, optimizer on, no networks configured
├── package.json
└── yarn.lock
```

Main dependencies: `hardhat` 2.x · `@openzeppelin/contracts` 5.x · `ethers` 6.x · `@nomicfoundation/hardhat-toolbox` 4.x · `typechain`

---

## License

MIT
